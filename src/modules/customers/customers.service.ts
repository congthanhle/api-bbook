// src/modules/customers/customers.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import dayjs = require('dayjs');
import { snakeCase } from 'lodash';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  CustomerResponseDto,
  CustomerStatsDto,
  CustomerLookupDto,
  MembershipTier,
} from './dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';

interface RequestingUser {
  id: string;
  role: string;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List customers with search, tier filter, sort, pagination.
   * Strips totalSpend if requestingUser.role === 'staff'
   */
  async findAll(
    query: CustomerQueryDto,
    requestingUser: RequestingUser,
  ): Promise<PaginatedResult<CustomerResponseDto>> {
    let q = this.supabase
      .getClient(true)
      .from('customers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Full-text search across name, phone, email
    if (query.search) {
      const term = `%${query.search}%`;
      q = q.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    if (query.tier) q = q.eq('membership_tier', query.tier);

    // Sorting
    const col = snakeCase(query.sortBy ?? 'created_at');
    q = q.order(col, { ascending: query.sortOrder === 'asc' });

    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) {
      this.logger.error(`Failed to fetch customers: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return {
      data: (data || []).map((c) => this.sanitize(c, requestingUser.role)),
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }

  /**
   * Get customer stats summary (admin only).
   */
  async getStats(): Promise<CustomerStatsDto> {
    const startOfMonth = dayjs().startOf('month').toISOString();
    const adminClient = this.supabase.getClient(true);

    // Total count + by tier counts
    const { data: tierCounts, error: tierError } = await adminClient
      .from('customers')
      .select('membership_tier')
      .is('deleted_at', null);

    if (tierError) {
      this.logger.error(`Failed to fetch tier stats: ${tierError.message}`);
      throw new InternalServerErrorException('Failed to fetch stats');
    }

    const byTier: Record<string, number> = { regular: 0, silver: 0, gold: 0, vip: 0 };
    tierCounts?.forEach((r) => {
      byTier[r.membership_tier] = (byTier[r.membership_tier] || 0) + 1;
    });

    const { count: newThisMonth } = await adminClient
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', startOfMonth);

    const { data: spendData } = await adminClient
      .from('customers')
      .select('total_spend')
      .is('deleted_at', null);

    // Explicitly cast sum to number
    const totalSpend = (spendData || []).reduce(
      (sum, c) => sum + (Number(c.total_spend) || 0),
      0,
    );
    const totalCustomers = tierCounts?.length ?? 0;

    return {
      totalCustomers,
      newThisMonth: newThisMonth ?? 0,
      byTier,
      avgSpendPerCustomer: totalCustomers > 0 ? Math.round(totalSpend / totalCustomers) : 0,
    };
  }

  /**
   * Get single customer by ID.
   * NO booking history — that belongs to BookingsModule.
   */
  async findOne(id: string, requestingUser: RequestingUser): Promise<CustomerResponseDto> {
    const { data, error } = await this.supabase
      .getClient(true)
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException(`Customer ${id} not found`);
    return this.sanitize(data, requestingUser.role);
  }

  /**
   * Lookup customer by exact phone number.
   * Called by BookingsModule during booking creation.
   * Always returns full data.
   */
  async findByPhone(phone: string): Promise<CustomerLookupDto> {
    const { data } = await this.supabase
      .getClient(true)
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .is('deleted_at', null)
      .maybeSingle();

    return {
      found: !!data,
      customer: data ? this.sanitize(data, 'admin') : undefined,
    };
  }

  /**
   * Create new customer.
   * Validates phone uniqueness before insert.
   */
  async create(dto: CreateCustomerDto, userId: string): Promise<CustomerResponseDto> {
    const { found } = await this.findByPhone(dto.phone);
    if (found) {
      throw new ConflictException(`Phone ${dto.phone} is already registered`);
    }

    const { data, error } = await this.supabase
      .getClient(true)
      .from('customers')
      .insert({
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        date_of_birth: dto.dateOfBirth ?? null,
        gender: dto.gender ?? null,
        notes: dto.notes ?? null,
        membership_tier: 'regular',
        total_visits: 0,
        total_spend: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    return this.sanitize(data, 'admin');
  }

  /**
   * Update customer profile fields.
   * Phone uniqueness re-checked if phone is changing.
   */
  async update(
    id: string,
    dto: UpdateCustomerDto,
    requestingUser: RequestingUser,
  ): Promise<CustomerResponseDto> {
    await this.findOne(id, requestingUser); // ensure exists

    if (dto.phone) {
      const { found, customer } = await this.findByPhone(dto.phone);
      if (found && customer && customer.id !== id) {
        throw new ConflictException(`Phone ${dto.phone} is already registered to another customer`);
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.phone !== undefined) updateData['phone'] = dto.phone;
    if (dto.email !== undefined) updateData['email'] = dto.email;
    if (dto.dateOfBirth !== undefined) updateData['date_of_birth'] = dto.dateOfBirth;
    if (dto.gender !== undefined) updateData['gender'] = dto.gender;
    if (dto.notes !== undefined) updateData['notes'] = dto.notes;

    const { data, error } = await this.supabase
      .getClient(true)
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update customer: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return this.sanitize(data, requestingUser.role);
  }

  /**
   * Soft-delete customer (admin only).
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient(true)
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete customer: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Export all active customers as CSV buffer (admin only).
   */
  async exportCsv(): Promise<Buffer> {
    const { data, error } = await this.supabase
      .getClient(true)
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to export customers: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    const header = 'Name,Phone,Email,Tier,Total Visits,Total Spend,Last Visit,Created At\n';
    const rows = (data || []).map((c) =>
      [
        `"${c.name}"`,
        c.phone,
        c.email ?? '',
        c.membership_tier,
        c.total_visits,
        c.total_spend,
        c.last_visit_at ?? '',
        dayjs(c.created_at).format('YYYY-MM-DD'),
      ].join(','),
    );

    return Buffer.from(header + rows.join('\n'), 'utf-8');
  }

  /**
   * Called by BookingsModule after booking completion.
   * Updates visits, spend, last visit, and recalculates tier.
   */
  async recordCompletedBooking(
    customerId: string,
    amount: number,
    bookingDate: string,
  ): Promise<void> {
    const { data: customer } = await this.supabase
      .getClient(true)
      .from('customers')
      .select('total_visits, total_spend')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    const newVisits = customer.total_visits + 1;
    const newSpend = customer.total_spend + amount;
    const newTier = this.computeTier(newVisits, newSpend);

    await this.supabase
      .getClient(true)
      .from('customers')
      .update({
        total_visits: newVisits,
        total_spend: newSpend,
        last_visit_at: bookingDate,
        membership_tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);
  }

  /**
   * Pure tier computation logic.
   */
  private computeTier(visits: number, spend: number): MembershipTier {
    if (visits >= 100 || spend >= 50_000_000) return MembershipTier.VIP;
    if (visits >= 30) return MembershipTier.GOLD;
    if (visits >= 10) return MembershipTier.SILVER;
    return MembershipTier.REGULAR;
  }

  /**
   * Strip sensitive fields based on requesting user's role.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitize(raw: any, role: string): CustomerResponseDto {
    const dto: CustomerResponseDto = {
      id: raw.id,
      name: raw.name,
      phone: raw.phone,
      email: raw.email,
      dateOfBirth: raw.date_of_birth,
      gender: raw.gender,
      membershipTier: raw.membership_tier as MembershipTier,
      totalVisits: raw.total_visits,
      lastVisitAt: raw.last_visit_at,
      notes: raw.notes,
      createdAt: raw.created_at,
    };

    if (role === 'admin') {
      dto.totalSpend = raw.total_spend;
    }
    return dto;
  }
}
