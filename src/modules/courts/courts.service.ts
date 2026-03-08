// src/modules/courts/courts.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import {
  CreateCourtDto,
  UpdateCourtDto,
  CreatePriceRuleDto,
  UpdatePriceRuleDto,
  BulkUpdatePricesDto,
  LockCourtDto,
  CourtQueryDto,
} from './dto';
import {
  CourtNotFoundException,
  PriceRuleConflictException,
} from './exceptions/court.exceptions';
import {
  normalisePagination,
  buildPaginationMeta,
} from '../../common/utils/pagination.helper';

/**
 * Service for managing courts, price rules, slot locks,
 * and price calculation.
 */
@Injectable()
export class CourtsService {
  private readonly logger = new Logger(CourtsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Helpers ───────────────────────────────────────────────

  /** Returns the admin Supabase client. */
  private get db() {
    return this.supabase.getClient(true);
  }

  /** Validates time order: timeStart < timeEnd. */
  private assertTimeOrder(start: string, end: string) {
    if (start >= end) {
      throw new BadRequestException('timeEnd must be after timeStart');
    }
  }

  /** Validates date order: startDate <= endDate. */
  private assertDateOrder(start: string, end: string) {
    if (start > end) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  /** Generates an array of ISO date strings between two dates (inclusive). */
  private dateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // ═══════════════════════════════════════════════════════════
  // COURT CRUD
  // ═══════════════════════════════════════════════════════════

  /**
   * Returns a paginated, filtered list of courts.
   * Includes a count of `price_rules` per court.
   */
  async findAll(query: CourtQueryDto) {
    const { page, limit, offset } = normalisePagination(query);

    let qb = this.db
      .from('courts')
      .select('*, price_rules(id)', { count: 'exact' });

    // Filters
    if (query.type) qb = qb.eq('type', query.type);
    if (query.isActive !== undefined) qb = qb.eq('is_active', query.isActive);
    if (query.search) qb = qb.ilike('name', `%${query.search}%`);

    qb = qb.order('name', { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await qb;

    if (error) {
      this.logger.error(`Failed to fetch courts: ${error.message}`);
      throw error;
    }

    // Map to response shape
    const courts = (data || []).map((c: Record<string, unknown>) => ({
      id: c['id'],
      name: c['name'],
      type: c['type'],
      description: c['description'],
      imageUrl: c['image_url'],
      isActive: c['is_active'],
      priceRulesCount: Array.isArray(c['price_rules'])
        ? (c['price_rules'] as unknown[]).length
        : 0,
      createdAt: c['created_at'],
      updatedAt: c['updated_at'],
    }));

    return {
      data: courts,
      meta: buildPaginationMeta(count || 0, page, limit),
    };
  }

  /**
   * Returns a single court with its price rules.
   */
  async findOne(id: string) {
    const { data, error } = await this.db
      .from('courts')
      .select('*, price_rules(*)')
      .eq('id', id)
      .single();

    if (error || !data) throw new CourtNotFoundException(id);

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      description: data.description,
      imageUrl: data.image_url,
      isActive: data.is_active,
      priceRules: data.price_rules || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Creates a new court.
   */
  async create(dto: CreateCourtDto) {
    const { data, error } = await this.db
      .from('courts')
      .insert({
        name: dto.name,
        type: dto.type,
        description: dto.description || null,
        image_url: dto.imageUrl || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create court: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Updates an existing court.
   */
  async update(id: string, dto: UpdateCourtDto) {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.type !== undefined) updateData['type'] = dto.type;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.imageUrl !== undefined) updateData['image_url'] = dto.imageUrl;
    if (dto.isActive !== undefined) updateData['is_active'] = dto.isActive;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const { data, error } = await this.db
      .from('courts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new CourtNotFoundException(id);
    return data;
  }

  /**
   * Soft-deletes a court by setting `is_active = false`.
   */
  async remove(id: string) {
    // Verify court exists
    const { data, error } = await this.db
      .from('courts')
      .update({ is_active: false })
      .eq('id', id)
      .select('id')
      .single();

    if (error || !data) throw new CourtNotFoundException(id);
    return { message: 'Court deactivated successfully' };
  }

  // ═══════════════════════════════════════════════════════════
  // PRICE RULES
  // ═══════════════════════════════════════════════════════════

  /**
   * Returns all price rules for a court.
   */
  async getPriceRules(courtId: string) {
    // Verify court exists first
    await this.findOne(courtId);

    const { data, error } = await this.db
      .from('price_rules')
      .select('*')
      .eq('court_id', courtId)
      .order('day_type', { ascending: true })
      .order('time_start', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch price rules: ${error.message}`);
      throw error;
    }

    return data || [];
  }

  /**
   * Adds a price rule to a court after checking for time overlaps.
   */
  async addPriceRule(courtId: string, dto: CreatePriceRuleDto) {
    this.assertTimeOrder(dto.timeStart, dto.timeEnd);

    // Verify court exists
    await this.findOne(courtId);

    // Check for overlapping rules on the same court + day_type
    await this.checkPriceRuleOverlap(courtId, dto.dayType, dto.timeStart, dto.timeEnd);

    const { data, error } = await this.db
      .from('price_rules')
      .insert({
        court_id: courtId,
        day_type: dto.dayType,
        specific_date: dto.specificDate || null,
        time_start: dto.timeStart,
        time_end: dto.timeEnd,
        price: dto.price,
      })
      .select()
      .single();

    if (error) {
      // Exclusion constraint violation
      if (error.code === '23P01') {
        throw new PriceRuleConflictException(courtId, dto.timeStart, dto.timeEnd);
      }
      this.logger.error(`Failed to add price rule: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Updates an existing price rule.
   */
  async updatePriceRule(ruleId: string, dto: UpdatePriceRuleDto) {
    if (dto.timeStart && dto.timeEnd) {
      this.assertTimeOrder(dto.timeStart, dto.timeEnd);
    }

    const updateData: Record<string, unknown> = {};
    if (dto.dayType !== undefined) updateData['day_type'] = dto.dayType;
    if (dto.specificDate !== undefined) updateData['specific_date'] = dto.specificDate;
    if (dto.timeStart !== undefined) updateData['time_start'] = dto.timeStart;
    if (dto.timeEnd !== undefined) updateData['time_end'] = dto.timeEnd;
    if (dto.price !== undefined) updateData['price'] = dto.price;

    const { data, error } = await this.db
      .from('price_rules')
      .update(updateData)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      if (error.code === '23P01') {
        throw new PriceRuleConflictException(ruleId, dto.timeStart || '', dto.timeEnd || '');
      }
      this.logger.error(`Failed to update price rule: ${error.message}`);
      throw error;
    }

    if (!data) {
      throw new BadRequestException(`Price rule "${ruleId}" not found`);
    }

    return data;
  }

  /**
   * Deletes a price rule.
   */
  async deletePriceRule(ruleId: string) {
    const { error } = await this.db
      .from('price_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      this.logger.error(`Failed to delete price rule: ${error.message}`);
      throw error;
    }

    return { message: 'Price rule deleted successfully' };
  }

  /**
   * Bulk upserts price rules for a court.
   * Deletes existing rules for the court first, then inserts all new rules.
   */
  async bulkUpdatePrices(courtId: string, dto: BulkUpdatePricesDto) {
    // Verify court exists
    await this.findOne(courtId);

    // Validate all rules
    for (const rule of dto.rules) {
      this.assertTimeOrder(rule.timeStart, rule.timeEnd);
    }

    // Delete existing rules for this court
    await this.db.from('price_rules').delete().eq('court_id', courtId);

    // Insert all new rules
    const rows = dto.rules.map((r: CreatePriceRuleDto) => ({
      court_id: courtId,
      day_type: r.dayType,
      specific_date: r.specificDate || null,
      time_start: r.timeStart,
      time_end: r.timeEnd,
      price: r.price,
    }));

    const { data, error } = await this.db
      .from('price_rules')
      .insert(rows)
      .select();

    if (error) {
      if (error.code === '23P01') {
        throw new PriceRuleConflictException(courtId, 'bulk', 'bulk');
      }
      this.logger.error(`Failed to bulk update rules: ${error.message}`);
      throw error;
    }

    return { count: (data || []).length, rules: data };
  }

  // ═══════════════════════════════════════════════════════════
  // COURT SLOT LOCKING
  // ═══════════════════════════════════════════════════════════

  /**
   * Locks or unlocks court time slots for a date range.
   *
   * For each date × timeSlot combination, upserts a row in
   * `court_slot_overrides` with the appropriate status.
   *
   * When `dto.timeSlotIds` is empty, all 32 slots are affected.
   */
  async lockOrUnlockCourt(courtId: string, dto: LockCourtDto, userId: string) {
    this.assertDateOrder(dto.startDate, dto.endDate);
    await this.findOne(courtId);

    const isLock = dto.action === 'lock';
    const newStatus = isLock ? 'locked' : 'available';
    const dates = this.dateRange(dto.startDate, dto.endDate);

    // Determine which time slots to affect
    let slotIds = dto.timeSlotIds || [];
    if (slotIds.length === 0) {
      // Fetch all 32 slot IDs
      const { data: allSlots } = await this.db
        .from('time_slots')
        .select('id')
        .order('slot_order', { ascending: true });
      slotIds = (allSlots || []).map((s: { id: string }) => s.id);
    }

    // Build upsert rows
    const rows = dates.flatMap((date) =>
      slotIds.map((slotId) => ({
        court_id: courtId,
        date,
        time_slot_id: slotId,
        status: newStatus,
        locked_reason: isLock ? (dto.reason || null) : null,
        locked_by: isLock ? userId : null,
      })),
    );

    // Upsert in batches of 500 (Supabase limit)
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await this.db
        .from('court_slot_overrides')
        .upsert(batch, { onConflict: 'court_id,date,time_slot_id' });

      if (error) {
        this.logger.error(`Slot ${dto.action} failed: ${error.message}`);
        throw error;
      }
      totalUpserted += batch.length;
    }

    return {
      message: `${totalUpserted} slot(s) ${dto.action}ed successfully`,
      dates: dates.length,
      slotsPerDate: slotIds.length,
      total: totalUpserted,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PRICE CALCULATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Calculates the total price for a booking by calling the
   * `calculate_booking_price()` PostgreSQL function.
   */
  async calculatePrice(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    this.assertTimeOrder(startTime, endTime);

    const { data, error } = await this.db.rpc('calculate_booking_price', {
      p_court_id: courtId,
      p_date: date,
      p_start: startTime,
      p_end: endTime,
    });

    if (error) {
      this.logger.error(`Price calculation failed: ${error.message}`);
      throw error;
    }

    return {
      courtId,
      date,
      startTime,
      endTime,
      totalPrice: data as number,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Checks for overlapping price rules before inserting.
   * This is a soft check — the DB exclusion constraint is the
   * ultimate safeguard.
   */
  private async checkPriceRuleOverlap(
    courtId: string,
    dayType: string,
    timeStart: string,
    timeEnd: string,
    excludeRuleId?: string,
  ) {
    let qb = this.db
      .from('price_rules')
      .select('id, time_start, time_end')
      .eq('court_id', courtId)
      .eq('day_type', dayType)
      .lt('time_start', timeEnd)
      .gt('time_end', timeStart);

    if (excludeRuleId) {
      qb = qb.neq('id', excludeRuleId);
    }

    const { data } = await qb;

    if (data && data.length > 0) {
      throw new PriceRuleConflictException(courtId, timeStart, timeEnd);
    }
  }
}
