// src/modules/staff/staff.service.ts

import {
  Injectable,
  Logger,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateStaffDto, UpdateStaffDto, StaffQueryDto, StaffStatus } from './dto';
import { normalisePagination, buildPaginationMeta, sanitizeForRole } from '../../common/utils';
import {
  StaffNotFoundException,
  SelfUpdateForbiddenException,
  DuplicateEmailException,
} from '../../common/exceptions';

/** Shape of the JWT user payload attached to the request. */
interface RequestingUser {
  sub: string;
  email: string;
  role: string;
}

/**
 * Service for managing staff members with role-based access control.
 *
 * - Admin: full CRUD + view all sensitive fields
 * - Staff: view own profile (no salary), update own limited fields
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ──────────────────────────────────────────────────────────
  // FIND ALL (admin only)
  // ──────────────────────────────────────────────────────────

  /**
   * Returns a paginated, searchable list of staff members.
   * Only accessible by admin users — staff should use `findMe()`.
   */
  async findAll(query: StaffQueryDto, requestingUser: RequestingUser) {
    if (requestingUser.role === 'staff') {
      throw new ForbiddenException('Staff users cannot list all staff. Use GET /staff/me instead.');
    }

    const { page, limit, offset } = normalisePagination(query);
    const client = this.supabase.getClient(true);

    // Build query: users LEFT JOIN staff_profiles
    let qb = client
      .from('users')
      .select(
        `
        id, name, phone, avatar_url, role, is_active, created_at, updated_at,
        staff_profiles (
          id, salary, salary_type, hire_date, notes,
          bank_name, bank_account_number, bank_account_name,
          id_card_number, address
        )
      `,
        { count: 'exact' },
      )
      .in('role', ['staff', 'admin']);

    // Apply status filter
    if (query.status === StaffStatus.ACTIVE) {
      qb = qb.eq('is_active', true);
    } else if (query.status === StaffStatus.INACTIVE) {
      qb = qb.eq('is_active', false);
    }

    // Apply role filter
    if (query.role) {
      qb = qb.eq('role', query.role);
    }

    // Apply search (name, phone ILIKE)
    if (query.search) {
      const search = `%${query.search}%`;
      qb = qb.or(`name.ilike.${search},phone.ilike.${search}`);
    }

    // Paginate
    qb = qb.order('created_at', { ascending: false });
    const { data, error, count } = await qb.range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to fetch staff: ${error.message}`);
      throw error;
    }

    // Fetch emails for each user from Supabase auth
    const staff = await this.attachEmails(data || []);

    return {
      data: staff,
      meta: buildPaginationMeta(count || 0, page, limit),
    };
  }

  // ──────────────────────────────────────────────────────────
  // FIND ME (own profile, no sensitive data)
  // ──────────────────────────────────────────────────────────

  /**
   * Fetches the authenticated user's own staff profile.
   * Salary and sensitive fields are stripped.
   */
  async findMe(userId: string) {
    const client = this.supabase.getClient(true);

    const { data, error } = await client
      .from('users')
      .select(
        `
        id, name, phone, avatar_url, role, is_active, created_at, updated_at,
        staff_profiles (
          id, salary, salary_type, hire_date, notes,
          bank_name, bank_account_number, bank_account_name,
          id_card_number, address
        )
      `,
      )
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new StaffNotFoundException(userId);
    }

    // Fetch email
    const { data: authUser } = await client.auth.admin.getUserById(userId);
    const result = this.mapToStaffDto(data, authUser?.user?.email || null);

    // Strip sensitive fields for staff
    return sanitizeForRole(result as Record<string, unknown>, 'staff');
  }

  // ──────────────────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────────────────

  /**
   * Fetches a single staff member by ID.
   * - Admin: can fetch any staff member
   * - Staff: only own record (delegates to findMe)
   */
  async findOne(id: string, requestingUser: RequestingUser) {
    if (requestingUser.role === 'staff') {
      if (id !== requestingUser.sub) {
        throw new ForbiddenException('Staff can only view their own profile');
      }
      return this.findMe(requestingUser.sub);
    }

    const client = this.supabase.getClient(true);
    const { data, error } = await client
      .from('users')
      .select(
        `
        id, name, phone, avatar_url, role, is_active, created_at, updated_at,
        staff_profiles (
          id, salary, salary_type, hire_date, notes,
          bank_name, bank_account_number, bank_account_name,
          id_card_number, address
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new StaffNotFoundException(id);
    }

    // Fetch email
    const { data: authUser } = await client.auth.admin.getUserById(id);

    return this.mapToStaffDto(data, authUser?.user?.email || null);
  }

  // ──────────────────────────────────────────────────────────
  // CREATE (admin only)
  // ──────────────────────────────────────────────────────────

  /**
   * Creates a new staff member:
   * 1. Creates auth user via Supabase admin API
   * 2. Inserts into public.users with role='staff'
   * 3. Inserts into staff_profiles
   */
  async create(dto: CreateStaffDto, _adminUserId: string) {
    const adminClient = this.supabase.getClient(true);

    // 1. Create auth user
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          name: dto.name,
          role: dto.role || 'staff',
        },
      });

    if (authError) {
      this.logger.error(`Failed to create auth user: ${authError.message}`);
      if (authError.message.includes('already been registered')) {
        throw new DuplicateEmailException(dto.email);
      }
      throw new InternalServerErrorException('Failed to create user account');
    }

    const userId = authData.user.id;

    try {
      // 2. Insert into public.users
      const { error: userError } = await adminClient
        .from('users')
        .upsert(
          {
            id: userId,
            name: dto.name,
            phone: dto.phone || null,
            avatar_url: dto.avatarUrl || null,
            role: dto.role || 'staff',
            is_active: dto.status !== 'inactive',
          },
          { onConflict: 'id' },
        );

      if (userError) {
        this.logger.error(`Failed to create user profile: ${userError.message}`);
        await adminClient.auth.admin.deleteUser(userId);
        throw new InternalServerErrorException('Failed to create user profile');
      }

      // 3. Insert into staff_profiles
      const { error: profileError } = await adminClient
        .from('staff_profiles')
        .insert({
          user_id: userId,
          salary: dto.salary,
          salary_type: dto.salaryType,
          hire_date: dto.hireDate,
          notes: dto.notes || null,
          bank_name: dto.bankName || null,
          bank_account_number: dto.bankAccountNumber || null,
          bank_account_name: dto.bankAccountName || null,
          id_card_number: dto.idCardNumber || null,
          address: dto.address || null,
        });

      if (profileError) {
        this.logger.error(`Failed to create staff profile: ${profileError.message}`);
        await adminClient.auth.admin.deleteUser(userId);
        throw new InternalServerErrorException('Failed to create staff profile');
      }
    } catch (err) {
      // If any step fails and hasn't been handled, clean up the auth user
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Unexpected error during staff creation: ${err}`);
      await adminClient.auth.admin.deleteUser(userId);
      throw new InternalServerErrorException('Failed to create staff member');
    }

    // Fetch and return the full record (admin view)
    return this.findOne(userId, { sub: _adminUserId, email: '', role: 'admin' });
  }

  // ──────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────

  /**
   * Updates a staff member.
   * - Admin: can update all fields for any staff
   * - Staff: can only update own profile with limited fields (phone, address, avatarUrl)
   */
  async update(id: string, dto: UpdateStaffDto, requestingUser: RequestingUser) {
    // Staff role restrictions
    if (requestingUser.role === 'staff') {
      if (id !== requestingUser.sub) {
        throw new SelfUpdateForbiddenException();
      }

      // Only allow UpdateOwnProfileDto fields
      const allowedFields = ['phone', 'address', 'avatarUrl'];
      const dtoKeys = Object.keys(dto).filter(
        (key) => dto[key as keyof UpdateStaffDto] !== undefined,
      );
      const disallowed = dtoKeys.filter((key) => !allowedFields.includes(key));
      if (disallowed.length > 0) {
        throw new ForbiddenException(
          `Staff cannot update fields: ${disallowed.join(', ')}`,
        );
      }
    }

    const adminClient = this.supabase.getClient(true);

    // Verify the staff exists
    const { data: existing, error: findError } = await adminClient
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      throw new StaffNotFoundException(id);
    }

    // Update users table fields
    const userUpdate: Record<string, unknown> = {};
    if (dto.name !== undefined) userUpdate['name'] = dto.name;
    if (dto.phone !== undefined) userUpdate['phone'] = dto.phone;
    if (dto.avatarUrl !== undefined) userUpdate['avatar_url'] = dto.avatarUrl;
    if (dto.role !== undefined) userUpdate['role'] = dto.role;
    if (dto.status !== undefined) userUpdate['is_active'] = dto.status !== 'inactive';

    if (Object.keys(userUpdate).length > 0) {
      const { error } = await adminClient
        .from('users')
        .update(userUpdate)
        .eq('id', id);

      if (error) {
        this.logger.error(`Failed to update user: ${error.message}`);
        throw new InternalServerErrorException('Failed to update user');
      }

      // Also update auth user metadata if role changed
      if (dto.role !== undefined) {
        await adminClient.auth.admin.updateUserById(id, {
          user_metadata: { role: dto.role },
        });
      }
    }

    // Update staff_profiles table fields
    const profileUpdate: Record<string, unknown> = {};
    if (dto.salary !== undefined) profileUpdate['salary'] = dto.salary;
    if (dto.salaryType !== undefined) profileUpdate['salary_type'] = dto.salaryType;
    if (dto.hireDate !== undefined) profileUpdate['hire_date'] = dto.hireDate;
    if (dto.notes !== undefined) profileUpdate['notes'] = dto.notes;
    if (dto.bankName !== undefined) profileUpdate['bank_name'] = dto.bankName;
    if (dto.bankAccountNumber !== undefined) profileUpdate['bank_account_number'] = dto.bankAccountNumber;
    if (dto.bankAccountName !== undefined) profileUpdate['bank_account_name'] = dto.bankAccountName;
    if (dto.idCardNumber !== undefined) profileUpdate['id_card_number'] = dto.idCardNumber;
    if (dto.address !== undefined) profileUpdate['address'] = dto.address;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await adminClient
        .from('staff_profiles')
        .upsert(
          { user_id: id, ...profileUpdate },
          { onConflict: 'user_id' }
        );

      if (error) {
        this.logger.error(`Failed to update staff profile: ${error.message}`);
        throw new InternalServerErrorException('Failed to update staff profile');
      }
    }

    // Return updated record, sanitized by role
    const result = await this.findOne(id, { sub: id, email: '', role: 'admin' });
    return sanitizeForRole(result as Record<string, unknown>, requestingUser.role);
  }

  // ──────────────────────────────────────────────────────────
  // DEACTIVATE / ACTIVATE (admin only)
  // ──────────────────────────────────────────────────────────

  /** Deactivates a staff member (sets is_active = false). */
  async deactivate(id: string) {
    const client = this.supabase.getClient(true);

    const { error } = await client
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to deactivate staff ${id}: ${error.message}`);
      throw new StaffNotFoundException(id);
    }

    return { message: 'Staff deactivated successfully' };
  }

  /** Activates a staff member (sets is_active = true). */
  async activate(id: string) {
    const client = this.supabase.getClient(true);

    const { error } = await client
      .from('users')
      .update({ is_active: true })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to activate staff ${id}: ${error.message}`);
      throw new StaffNotFoundException(id);
    }

    return { message: 'Staff activated successfully' };
  }

  // ──────────────────────────────────────────────────────────
  // STAFF SHIFTS
  // ──────────────────────────────────────────────────────────

  /**
   * Returns shifts assigned to a staff member, optionally filtered by month.
   * Staff can only view their own shifts.
   */
  async getStaffShifts(
    staffId: string,
    query: { month?: string },
    requestingUser: RequestingUser,
  ) {
    if (requestingUser.role === 'staff' && staffId !== requestingUser.sub) {
      throw new ForbiddenException('Staff can only view their own shifts');
    }

    const client = this.supabase.getClient(true);

    let qb = client
      .from('shifts')
      .select('*')
      .eq('staff_id', staffId)
      .order('shift_date', { ascending: false })
      .order('start_time', { ascending: true });

    // Filter by month (format: YYYY-MM)
    if (query.month) {
      const startDate = `${query.month}-01`;
      // Calculate end of month
      const [year, month] = query.month.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${query.month}-${String(lastDay).padStart(2, '0')}`;
      qb = qb.gte('shift_date', startDate).lte('shift_date', endDate);
    }

    const { data, error } = await qb;

    if (error) {
      this.logger.error(`Failed to fetch shifts for staff ${staffId}: ${error.message}`);
      throw error;
    }

    return data || [];
  }

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────

  /**
   * Attaches email addresses to user records by fetching from Supabase auth.
   * Uses admin API to list users by ID.
   */
  private async attachEmails(users: Record<string, unknown>[]) {
    if (users.length === 0) return users;

    const client = this.supabase.getClient(true);
    const results = [];

    for (const user of users) {
      const { data: authUser } = await client.auth.admin.getUserById(
        user['id'] as string,
      );
      results.push(this.mapToStaffDto(user, authUser?.user?.email || null));
    }

    return results;
  }

  /**
   * Flattens the staff record and maps snake_case DB columns to camelCase DTOs.
   */
  private mapToStaffDto(user: Record<string, any>, email: string | null = null) {
    const profile = Array.isArray(user['staff_profiles']) 
      ? user['staff_profiles'][0] 
      : user['staff_profiles'] || {};

    return {
      id: user.id,
      name: user.name,
      email: email,
      phone: user.phone || undefined,
      avatarUrl: user.avatar_url || undefined,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      
      // Flattened profile fields
      salary: profile.salary,
      salaryType: profile.salary_type,
      hireDate: profile.hire_date,
      notes: profile.notes || undefined,
      bankName: profile.bank_name || undefined,
      bankAccountNumber: profile.bank_account_number || undefined,
      bankAccountName: profile.bank_account_name || undefined,
      idCardNumber: profile.id_card_number || undefined,
      address: profile.address || undefined,
    };
  }
}
