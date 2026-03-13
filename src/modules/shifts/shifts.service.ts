// src/modules/shifts/shifts.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import {
  CreateShiftDto,
  UpdateShiftDto,
  AssignStaffDto,
  ShiftQueryDto,
  ShiftStatus,
  BulkCreateShiftDto,
} from './dto';
import { normalisePagination, buildPaginationMeta } from '../../common/utils/pagination.helper';

/** Shape of the JWT user payload attached to the request. */
interface RequestingUser {
  sub: string;
  email: string;
  role: string;
}

/**
 * Service for managing shifts with RBAC, staff assignments,
 * check-in/checkout, and conflict detection.
 *
 * Tables used:
 *  - `shifts` (id, name, date, start_time, end_time, notes, status, created_by, created_at, updated_at)
 *  - `shift_assignments` (id, shift_id, staff_id, checked_in_at, checked_out_at, notes, created_at)
 */
@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ──────────────────────────────────────────────────────────
  // FIND ALL
  // ──────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of shifts.
   * - Admin: all shifts matching query
   * - Staff: only shifts they are assigned to
   */
  async findAll(query: ShiftQueryDto, requestingUser: RequestingUser) {
    const { page, limit, offset } = normalisePagination(query);
    const client = this.supabase.getClient(true);

    if (requestingUser.role === 'staff') {
      return this.findStaffShifts(query, requestingUser.sub, page, limit, offset);
    }

    // Admin: query shifts directly
    let qb = client
      .from('shifts')
      .select(
        `
        *,
        shift_assignments (
          id, staff_id, checked_in_at, checked_out_at, notes,
          users:staff_id ( id, name, avatar_url )
        )
      `,
        { count: 'exact' },
      );

    qb = this.applyShiftFilters(qb, query);
    qb = qb.order('date', { ascending: false }).order('start_time', { ascending: true });

    const { data, error, count } = await qb.range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to fetch shifts: ${error.message}`);
      throw error;
    }

    return { data: data || [], meta: buildPaginationMeta(count || 0, page, limit) };
  }

  /**
   * Finds shifts assigned to a specific staff member.
   */
  private async findStaffShifts(
    query: ShiftQueryDto,
    staffId: string,
    page: number,
    limit: number,
    offset: number,
  ) {
    const client = this.supabase.getClient(true);

    // First get assigned shift IDs
    let assignQb = client
      .from('shift_assignments')
      .select('shift_id')
      .eq('staff_id', staffId);

    const { data: assignments, error: assignError } = await assignQb;

    if (assignError) {
      this.logger.error(`Failed to fetch staff assignments: ${assignError.message}`);
      throw assignError;
    }

    const shiftIds = (assignments || []).map((a: { shift_id: string }) => a.shift_id);
    if (shiftIds.length === 0) {
      return { data: [], meta: buildPaginationMeta(0, page, limit) };
    }

    // Then fetch those shifts with all assignments
    let qb = client
      .from('shifts')
      .select(
        `
        *,
        shift_assignments (
          id, staff_id, checked_in_at, checked_out_at, notes,
          users:staff_id ( id, name, avatar_url )
        )
      `,
        { count: 'exact' },
      )
      .in('id', shiftIds);

    qb = this.applyShiftFilters(qb, query);
    qb = qb.order('date', { ascending: false }).order('start_time', { ascending: true });

    const { data, error, count } = await qb.range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to fetch staff shifts: ${error.message}`);
      throw error;
    }

    return { data: data || [], meta: buildPaginationMeta(count || 0, page, limit) };
  }

  // ──────────────────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────────────────

  /**
   * Fetches a single shift by ID.
   * - Admin: any shift
   * - Staff: only if they are assigned to it
   */
  async findOne(id: string, requestingUser: RequestingUser) {
    const client = this.supabase.getClient(true);

    const { data, error } = await client
      .from('shifts')
      .select(
        `
        *,
        shift_assignments (
          id, staff_id, checked_in_at, checked_out_at, notes,
          users:staff_id ( id, name, avatar_url )
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Shift "${id}" not found`);
    }

    // Staff can only view shifts they are assigned to
    if (requestingUser.role === 'staff') {
      const isAssigned = (data.shift_assignments || []).some(
        (a: { staff_id: string }) => a.staff_id === requestingUser.sub,
      );
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this shift');
      }
    }

    return data;
  }

  // ──────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────

  /**
   * Creates a new shift (admin only).
   * Validates time range, inserts shift, optionally assigns staff with conflict checks.
   */
  async create(dto: CreateShiftDto, adminId: string) {
    // Validate endTime > startTime
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const client = this.supabase.getClient(true);

    // Calculate status based on now
    const status = this.calculateStatus(dto.date, dto.startTime, dto.endTime);

    // Insert shift
    const { data: shift, error } = await client
      .from('shifts')
      .insert({
        name: dto.name,
        date: dto.date,
        start_time: dto.startTime,
        end_time: dto.endTime,
        notes: dto.notes || null,
        status,
        created_by: adminId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create shift: ${error.message}`);
      throw new InternalServerErrorException('Failed to create shift');
    }

    // If staffIds provided, assign them
    if (dto.staffIds && dto.staffIds.length > 0) {
      // Conflict check for each staff
      const conflicts: string[] = [];
      for (const staffId of dto.staffIds) {
        const conflict = await this.conflictCheck(staffId, dto.date, dto.startTime, dto.endTime);
        if (conflict.hasConflict) {
          conflicts.push(`Staff ${staffId} has a conflicting shift`);
        }
      }

      if (conflicts.length > 0) {
        throw new ConflictException({
          code: 'SHIFT_CONFLICT',
          message: 'One or more staff have conflicting shifts',
          details: conflicts,
        });
      }

      // Bulk insert assignments
      const assignments = dto.staffIds.map((staffId) => ({
        shift_id: shift.id,
        staff_id: staffId,
      }));

      const { error: assignError } = await client
        .from('shift_assignments')
        .insert(assignments);

      if (assignError) {
        this.logger.error(`Failed to assign staff: ${assignError.message}`);
        // Shift was created, return it anyway but log the error
      }
    }

    // Return shift with assignments
    return this.findOne(shift.id, { sub: adminId, email: '', role: 'admin' });
  }

  /**
   * Bulk creates shifts across a date range (admin only).
   */
  async createBulk(dto: BulkCreateShiftDto, adminId: string) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const createdShifts = [];

    // Simple loop through days
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      const createDto: CreateShiftDto = {
        name: dto.name,
        date: dateStr,
        startTime: dto.startTime,
        endTime: dto.endTime,
        notes: dto.notes,
        staffIds: dto.staffIds,
      };

      try {
        const shift = await this.create(createDto, adminId);
        createdShifts.push(shift);
      } catch (e) {
        this.logger.warn(`Bulk creation: skipped conflict on ${dateStr}`);
        // For bulk, we might want to continue or collect errors. 
        // Let's collect and return successfully created ones for now.
      }
      
      current.setDate(current.getDate() + 1);
    }

    return createdShifts;
  }

  // ──────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────

  /**
   * Updates shift fields (admin only). Does not modify assignments.
   */
  async update(id: string, dto: UpdateShiftDto) {
    const client = this.supabase.getClient(true);

    // Validate time range if both are provided
    if (dto.startTime && dto.endTime && dto.endTime <= dto.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.date !== undefined) updateData['date'] = dto.date;
    if (dto.startTime !== undefined) updateData['start_time'] = dto.startTime;
    if (dto.endTime !== undefined) updateData['end_time'] = dto.endTime;
    if (dto.notes !== undefined) updateData['notes'] = dto.notes;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const { data: current } = await client
      .from('shifts')
      .select('date, start_time, end_time, status')
      .eq('id', id)
      .single();

    if (!current) throw new NotFoundException(`Shift "${id}" not found`);

    if (dto.date || dto.startTime || dto.endTime) {
      const newDate = dto.date ?? current.date;
      const newStart = dto.startTime ?? current.start_time;
      const newEnd = dto.endTime ?? current.end_time;
      updateData['status'] = this.calculateStatus(newDate, newStart, newEnd);
    }

    const { data, error } = await client
      .from('shifts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Shift "${id}" not found`);
    }

    return data;
  }

  /**
   * Manually updates a shift status (admin only).
   */
  async updateStatus(id: string, dto: { status: ShiftStatus }) {
    const client = this.supabase.getClient(true);

    const { data, error } = await client
      .from('shifts')
      .update({ status: dto.status })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Shift "${id}" not found`);
    }

    return data;
  }

  // ──────────────────────────────────────────────────────────
  // REMOVE
  // ──────────────────────────────────────────────────────────

  /**
   * Deletes a shift (admin only). Only allowed for 'upcoming' shifts.
   * Removes assignments first, then the shift.
   */
  async remove(id: string) {
    const client = this.supabase.getClient(true);

    // Check shift exists and status
    const { data: shift, error: findError } = await client
      .from('shifts')
      .select('id, status')
      .eq('id', id)
      .single();

    if (findError || !shift) {
      throw new NotFoundException(`Shift "${id}" not found`);
    }

    if (shift.status !== ShiftStatus.UPCOMING) {
      throw new BadRequestException(
        `Cannot delete a shift with status "${shift.status}". Only upcoming shifts can be deleted.`,
      );
    }

    // Delete assignments first
    await client.from('shift_assignments').delete().eq('shift_id', id);

    // Delete shift
    const { error } = await client.from('shifts').delete().eq('id', id);
    if (error) {
      this.logger.error(`Failed to delete shift ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete shift');
    }

    return { message: 'Shift deleted successfully' };
  }

  // ──────────────────────────────────────────────────────────
  // ASSIGN / UNASSIGN STAFF
  // ──────────────────────────────────────────────────────────

  /**
   * Assigns staff members to a shift (admin only).
   * Performs conflict check for each staff member first.
   */
  async assignStaff(shiftId: string, dto: AssignStaffDto, _adminId: string) {
    const client = this.supabase.getClient(true);

    // Fetch shift to get date and times
    const { data: shift, error: shiftError } = await client
      .from('shifts')
      .select('id, date, start_time, end_time')
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      throw new NotFoundException(`Shift "${shiftId}" not found`);
    }

    // Conflict check for each staff
    const conflicts: string[] = [];
    for (const staffId of dto.staffIds) {
      const conflict = await this.conflictCheck(
        staffId,
        shift.date,
        shift.start_time,
        shift.end_time,
        shiftId, // exclude this shift from conflict check
      );
      if (conflict.hasConflict) {
        conflicts.push(`Staff ${staffId} has a conflicting shift`);
      }
    }

    if (conflicts.length > 0) {
      throw new ConflictException({
        code: 'SHIFT_CONFLICT',
        message: 'One or more staff have conflicting shifts',
        details: conflicts,
      });
    }

    // Bulk upsert assignments (ignore duplicates)
    const assignments = dto.staffIds.map((staffId) => ({
      shift_id: shiftId,
      staff_id: staffId,
    }));

    const { error } = await client
      .from('shift_assignments')
      .upsert(assignments, { onConflict: 'shift_id,staff_id' });

    if (error) {
      this.logger.error(`Failed to assign staff: ${error.message}`);
      throw new InternalServerErrorException('Failed to assign staff');
    }

    // Return updated assignments
    const { data: updated } = await client
      .from('shift_assignments')
      .select(
        `
        id, staff_id, checked_in_at, checked_out_at, notes,
        users:staff_id ( id, name, avatar_url )
      `,
      )
      .eq('shift_id', shiftId);

    return updated || [];
  }

  /**
   * Removes a staff member from a shift (admin only).
   */
  async unassignStaff(shiftId: string, staffId: string) {
    const client = this.supabase.getClient(true);

    const { error } = await client
      .from('shift_assignments')
      .delete()
      .eq('shift_id', shiftId)
      .eq('staff_id', staffId);

    if (error) {
      this.logger.error(`Failed to unassign staff: ${error.message}`);
      throw new InternalServerErrorException('Failed to unassign staff');
    }

    return { message: 'Staff unassigned successfully' };
  }

  // ──────────────────────────────────────────────────────────
  // CHECK-IN / CHECK-OUT
  // ──────────────────────────────────────────────────────────

  /**
   * Records a staff member checking in to a shift.
   * Sets checked_in_at and transitions shift status from upcoming → ongoing.
   */
  async checkIn(shiftId: string, staffId: string, notes?: string) {
    const client = this.supabase.getClient(true);

    // Verify assignment exists
    const { data: assignment, error: assignError } = await client
      .from('shift_assignments')
      .select('id, checked_in_at')
      .eq('shift_id', shiftId)
      .eq('staff_id', staffId)
      .single();

    if (assignError || !assignment) {
      throw new NotFoundException('Shift assignment not found. You are not assigned to this shift.');
    }

    if (assignment.checked_in_at) {
      throw new BadRequestException('Already checked in to this shift');
    }

    // Update assignment with check-in time
    const updateData: Record<string, unknown> = {
      checked_in_at: new Date().toISOString(),
    };
    if (notes) updateData['notes'] = notes;

    const { error: updateError } = await client
      .from('shift_assignments')
      .update(updateData)
      .eq('id', assignment.id);

    if (updateError) {
      this.logger.error(`Failed to check in: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to check in');
    }

    // Transition shift status: upcoming → ongoing
    await client
      .from('shifts')
      .update({ status: ShiftStatus.ONGOING })
      .eq('id', shiftId)
      .eq('status', ShiftStatus.UPCOMING);

    return { message: 'Checked in successfully', checkedInAt: updateData['checked_in_at'] };
  }

  /**
   * Records a staff member checking out from a shift.
   * Sets checked_out_at. If all staff checked out, transitions shift to completed.
   */
  async checkOut(shiftId: string, staffId: string) {
    const client = this.supabase.getClient(true);

    // Verify assignment exists and is checked in
    const { data: assignment, error: assignError } = await client
      .from('shift_assignments')
      .select('id, checked_in_at, checked_out_at')
      .eq('shift_id', shiftId)
      .eq('staff_id', staffId)
      .single();

    if (assignError || !assignment) {
      throw new NotFoundException('Shift assignment not found');
    }

    if (!assignment.checked_in_at) {
      throw new BadRequestException('Must check in before checking out');
    }

    if (assignment.checked_out_at) {
      throw new BadRequestException('Already checked out from this shift');
    }

    const checkedOutAt = new Date().toISOString();

    const { error: updateError } = await client
      .from('shift_assignments')
      .update({ checked_out_at: checkedOutAt })
      .eq('id', assignment.id);

    if (updateError) {
      this.logger.error(`Failed to check out: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to check out');
    }

    // Check if all assignments are checked out → mark shift as completed
    const { data: allAssignments } = await client
      .from('shift_assignments')
      .select('id, checked_out_at')
      .eq('shift_id', shiftId);

    const allCheckedOut = (allAssignments || []).every(
      (a: { checked_out_at: string | null }) => a.checked_out_at !== null,
    );

    if (allCheckedOut && (allAssignments || []).length > 0) {
      await client
        .from('shifts')
        .update({ status: ShiftStatus.COMPLETED })
        .eq('id', shiftId);
    }

    return { message: 'Checked out successfully', checkedOutAt };
  }

  // ──────────────────────────────────────────────────────────
  // MONTHLY CALENDAR
  // ──────────────────────────────────────────────────────────

  /**
   * Returns shifts grouped by date for a given month (YYYY-MM).
   * Staff: only their assigned shifts.
   */
  async getMonthlyCalendar(yearMonth: string, requestingUser: RequestingUser) {
    const client = this.supabase.getClient(true);

    // Calculate date range
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    let shiftIds: string[] | null = null;

    // Staff: get only assigned shift IDs
    if (requestingUser.role === 'staff') {
      const { data: assignments } = await client
        .from('shift_assignments')
        .select('shift_id')
        .eq('staff_id', requestingUser.sub);

      shiftIds = (assignments || []).map((a: { shift_id: string }) => a.shift_id);
      if (shiftIds.length === 0) {
        return {};
      }
    }

    let qb = client
      .from('shifts')
      .select(
        `
        *,
        shift_assignments (
          id, staff_id, checked_in_at, checked_out_at,
          users:staff_id ( id, name, avatar_url )
        )
      `,
      )
      .gte('date', startDate)
      .lte('date', endDate)
      .order('start_time', { ascending: true });

    if (shiftIds) {
      qb = qb.in('id', shiftIds);
    }

    const { data, error } = await qb;

    if (error) {
      this.logger.error(`Failed to fetch calendar: ${error.message}`);
      throw error;
    }

    // Group by date
    const calendar: Record<string, unknown[]> = {};
    for (const shift of data || []) {
      const dateKey = shift.date;
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(shift);
    }

    return calendar;
  }

  // ──────────────────────────────────────────────────────────
  // CONFLICT CHECK
  // ──────────────────────────────────────────────────────────

  /**
   * Checks if a staff member has a conflicting shift on the given date/time range.
   * Overlap: existing.start_time < newEnd AND existing.end_time > newStart
   */
  async conflictCheck(
    staffId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeShiftId?: string,
  ): Promise<{ hasConflict: boolean; conflictingShift?: unknown }> {
    const client = this.supabase.getClient(true);

    // Get all shift IDs assigned to this staff member
    const { data: assignments } = await client
      .from('shift_assignments')
      .select('shift_id')
      .eq('staff_id', staffId);

    const assignedShiftIds = (assignments || []).map(
      (a: { shift_id: string }) => a.shift_id,
    );

    if (assignedShiftIds.length === 0) {
      return { hasConflict: false };
    }

    // Now find shifts on this date that overlap the time range
    let qb = client
      .from('shifts')
      .select('id, name, date, start_time, end_time, status')
      .in('id', assignedShiftIds)
      .eq('date', date)
      .lt('start_time', endTime)   // existing start < new end
      .gt('end_time', startTime);  // existing end > new start

    if (excludeShiftId) {
      qb = qb.neq('id', excludeShiftId);
    }

    const { data: conflicts, error } = await qb;

    if (error) {
      this.logger.error(`Conflict check failed: ${error.message}`);
      return { hasConflict: false };
    }

    if (conflicts && conflicts.length > 0) {
      return { hasConflict: true, conflictingShift: conflicts[0] };
    }

    return { hasConflict: false };
  }

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────

  /**
   * Applies common filters (date, month, staffId, status) to a query builder.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyShiftFilters(qb: any, query: ShiftQueryDto) {
    if (query.date) {
      qb = qb.eq('date', query.date);
    }

    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      const startDate = `${query.month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${query.month}-${String(lastDay).padStart(2, '0')}`;
      qb = qb.gte('date', startDate).lte('date', endDate);
    }

    if (query.status) {
      qb = qb.eq('status', query.status);
    }

    return qb;
  }

  /**
   * Calculates shift status based on the current system time.
   */
  private calculateStatus(date: string, startTime: string, endTime: string): ShiftStatus {
    const now = new Date();
    // Shift end: date T endTime
    const shiftEnd = new Date(`${date}T${endTime}`);
    // Shift start: date T startTime
    const shiftStart = new Date(`${date}T${startTime}`);

    if (now > shiftEnd) {
      return ShiftStatus.COMPLETED;
    } else if (now >= shiftStart && now <= shiftEnd) {
      return ShiftStatus.ONGOING;
    } else {
      return ShiftStatus.UPCOMING;
    }
  }
}
