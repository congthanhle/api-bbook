// src/modules/overview/overview.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SlotStateService } from './slot-state.service';
import {
  GetOverviewDto,
  UpdateSlotStatusDto,
  BulkUpdateSlotsDto,
  MonthLockDto,
} from './dto';

/**
 * Service for the court overview grid — the primary booking surface.
 *
 * Handles grid data, slot state management (lock/unlock/maintenance),
 * and month-level access control.
 */
@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly slotState: SlotStateService,
  ) {}

  private get db() {
    return this.supabase.getClient(true);
  }

  // ──────────────────────────────────────────────────────────
  // OVERVIEW GRID
  // ──────────────────────────────────────────────────────────

  /**
   * Returns the full overview grid for a given date.
   *
   * Calls the DB function `get_court_overview(p_date)` which returns
   * all courts × all 32 slots with computed statuses, then enriches
   * with summary counts.
   */
  async getOverview(dto: GetOverviewDto) {
    // Use the DB function for efficient grid computation
    const { data: gridData, error } = await this.db.rpc('get_court_overview', {
      p_date: dto.date,
    });

    if (error) {
      this.logger.error(`Failed to get overview: ${error.message}`);
      throw error;
    }

    let courts = (gridData as Record<string, unknown>[]) || [];

    // Filter by court IDs if specified
    if (dto.courtIds && dto.courtIds.length > 0) {
      courts = courts.filter((c: Record<string, unknown>) =>
        dto.courtIds!.includes(c['court_id'] as string),
      );
    }

    // Enrich with booking details for booked slots
    const enrichedCourts = await Promise.all(
      courts.map(async (court: Record<string, unknown>) => {
        const slots = (court['slots'] as Record<string, unknown>[]) || [];

        // Batch-fetch booked slot booking details
        const bookedSlots = slots.filter(
          (s: Record<string, unknown>) => s['status'] === 'booked' && s['booking_id'],
        );

        let bookingDetailsMap = new Map<string, Record<string, unknown>>();
        if (bookedSlots.length > 0) {
          const bookingIds = [
            ...new Set(bookedSlots.map((s: Record<string, unknown>) => s['booking_id'] as string)),
          ];

          const { data: bookings } = await this.db
            .from('bookings')
            .select('id, booking_code, customer_id, status, payment_status')
            .in('id', bookingIds);

          if (bookings) {
            // Fetch customer names
            const customerIds = [
              ...new Set(bookings.map((b: Record<string, unknown>) => b['customer_id'] as string)),
            ];
            const { data: customers } = await this.db
              .from('customers')
              .select('id, name, phone')
              .in('id', customerIds);

            const customerMap = new Map(
              (customers || []).map((c: Record<string, unknown>) => [c['id'] as string, c]),
            );

            bookingDetailsMap = new Map(
              bookings.map((b: Record<string, unknown>) => {
                const customer = customerMap.get(b['customer_id'] as string);
                return [
                  b['id'] as string,
                  {
                    bookingCode: b['booking_code'],
                    customerName: (customer as Record<string, unknown> | undefined)?.['name'] || null,
                    customerPhone: (customer as Record<string, unknown> | undefined)?.['phone'] || null,
                    bookingStatus: b['status'],
                    paymentStatus: b['payment_status'],
                  },
                ];
              }),
            );
          }
        }

        // Map slots with enriched data
        const enrichedSlots = slots.map((s: Record<string, unknown>) => {
          const bookingId = s['booking_id'] as string | null;
          const details = bookingId ? bookingDetailsMap.get(bookingId) : null;

          return {
            timeSlotId: s['slot_id'],
            label: s['label'],
            startTime: s['start_time'],
            endTime: s['end_time'],
            status: s['status'],
            bookingId,
            bookingCode: details?.['bookingCode'] || null,
            customerName: details?.['customerName'] || null,
            customerPhone: details?.['customerPhone'] || null,
            bookingStatus: details?.['bookingStatus'] || null,
            paymentStatus: details?.['paymentStatus'] || null,
            lockedReason: s['locked_reason'] || null,
          };
        });

        return {
          courtId: court['court_id'],
          courtName: court['court_name'],
          courtType: court['court_type'],
          slots: enrichedSlots,
        };
      }),
    );

    // Build summary
    const allSlots = enrichedCourts.flatMap((c) => c.slots);
    const summary = {
      available: allSlots.filter((s) => s.status === 'available').length,
      booked: allSlots.filter((s) => s.status === 'booked').length,
      locked: allSlots.filter((s) => s.status === 'locked').length,
      maintenance: allSlots.filter((s) => s.status === 'maintenance').length,
      total: allSlots.length,
    };

    // Month lock status
    const yearMonth = dto.date.substring(0, 7);
    const { data: monthLock } = await this.db
      .from('month_locks')
      .select('is_locked, unlocked_by, unlocked_at')
      .eq('year_month', yearMonth)
      .single();

    return {
      date: dto.date,
      monthLock: monthLock || { is_locked: true, unlocked_by: null, unlocked_at: null },
      courts: enrichedCourts,
      summary,
    };
  }

  // ──────────────────────────────────────────────────────────
  // SLOT STATUS MANAGEMENT
  // ──────────────────────────────────────────────────────────

  /**
   * Update a single slot's status (lock/unlock/maintenance).
   * Cannot manually change a 'booked' slot — use bookings API to cancel.
   */
  async updateSlotStatus(dto: UpdateSlotStatusDto, userId: string) {
    // Resolve time slot ID (may be HHmm format from frontend)
    const resolvedTimeSlotId = await this.resolveTimeSlotId(dto.timeSlotId);

    // Check if current slot is booked
    const { data: existing } = await this.db
      .from('court_slot_overrides')
      .select('status, booking_id')
      .eq('court_id', dto.courtId)
      .eq('date', dto.date)
      .eq('time_slot_id', resolvedTimeSlotId)
      .single();

    if (existing?.status === 'booked') {
      throw new BadRequestException(
        'Cannot manually change a booked slot. Cancel the booking first.',
      );
    }

    // Upsert the override
    if (dto.status === 'available' && existing) {
      // Remove the override to revert to default
      await this.db
        .from('court_slot_overrides')
        .delete()
        .eq('court_id', dto.courtId)
        .eq('date', dto.date)
        .eq('time_slot_id', resolvedTimeSlotId);
    } else if (dto.status !== 'available') {
      await this.db.from('court_slot_overrides').upsert(
        {
          court_id: dto.courtId,
          date: dto.date,
          time_slot_id: resolvedTimeSlotId,
          status: dto.status,
          locked_reason: dto.reason || null,
          locked_by: userId,
        },
        { onConflict: 'court_id,date,time_slot_id' },
      );
    }

    return { message: `Slot updated to ${dto.status}` };
  }

  /**
   * Bulk-update slot statuses. Skips any slots that are currently booked.
   */
  async bulkUpdateSlots(dto: BulkUpdateSlotsDto, userId: string) {
    // 1. Resolve all timeSlotIds (HHmm -> UUID mapping)
    const resolvedSlots = await Promise.all(
      dto.slots.map(async (slot) => {
        const resolvedId = await this.resolveTimeSlotId(slot.timeSlotId);
        return { ...slot, timeSlotId: resolvedId };
      })
    );

    // 2. Batch-fetch existing overrides for these slots
    const slotKeys = resolvedSlots.map(
      (s) => `${s.courtId}_${s.timeSlotId}`,
    );

    const courtIds = [...new Set(resolvedSlots.map((s) => s.courtId))];

    const { data: existingOverrides } = await this.db
      .from('court_slot_overrides')
      .select('court_id, time_slot_id, status, booking_id')
      .eq('date', dto.date)
      .in('court_id', courtIds);

    const existingMap = new Map(
      (existingOverrides || []).map((o: Record<string, unknown>) => [
        `${o['court_id']}_${o['time_slot_id']}`,
        o,
      ]),
    );

    const toUpsert: Record<string, unknown>[] = [];
    const toDelete: { courtId: string; timeSlotId: string }[] = [];
    const skipped: { courtId: string; timeSlotId: string; reason: string }[] = [];

    for (const slot of resolvedSlots) {
      const key = `${slot.courtId}_${slot.timeSlotId}`;
      const existing = existingMap.get(key) as Record<string, unknown> | undefined;

      // Skip booked slots
      if (existing?.['status'] === 'booked') {
        skipped.push({
          courtId: slot.courtId,
          timeSlotId: slot.timeSlotId,
          reason: `Slot is booked (booking: ${existing?.['booking_id']})`,
        });
        continue;
      }

      if (slot.status === 'available' && existing) {
        toDelete.push({ courtId: slot.courtId, timeSlotId: slot.timeSlotId });
      } else if (slot.status !== 'available') {
        toUpsert.push({
          court_id: slot.courtId,
          date: dto.date,
          time_slot_id: slot.timeSlotId,
          status: slot.status,
          locked_reason: slot.reason || null,
          locked_by: userId,
        });
      }
    }

    // Execute upserts
    if (toUpsert.length > 0) {
      const { error } = await this.db
        .from('court_slot_overrides')
        .upsert(toUpsert, { onConflict: 'court_id,date,time_slot_id' });

      if (error) {
        this.logger.error(`Bulk slot update failed: ${error.message}`);
        throw error;
      }
    }

    // Execute deletes (set back to available)
    for (const del of toDelete) {
      await this.db
        .from('court_slot_overrides')
        .delete()
        .eq('court_id', del.courtId)
        .eq('date', dto.date)
        .eq('time_slot_id', del.timeSlotId);
    }

    return {
      updated: toUpsert.length + toDelete.length,
      skipped: skipped.length,
      skippedReasons: skipped,
    };
  }

  /**
   * Resolve a time slot identifier to a UUID.
   * Accepts either a UUID (passed through) or an HHmm-format string (e.g., '0600')
   * which is resolved by looking up the time_slots table by label (e.g., '06:00').
   */
  private async resolveTimeSlotId(timeSlotId: string): Promise<string> {
    // Check if it's already a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(timeSlotId)) {
      return timeSlotId;
    }

    // Convert HHmm to HH:MM label format for lookup
    const label = `${timeSlotId.substring(0, 2)}:${timeSlotId.substring(2, 4)}`;
    const { data, error } = await this.db
      .from('time_slots')
      .select('id')
      .eq('label', label)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Time slot not found for identifier: ${timeSlotId}`);
    }

    return data.id;
  }

  // ──────────────────────────────────────────────────────────
  // MONTH LOCKS
  // ──────────────────────────────────────────────────────────

  /**
   * Get all month lock statuses.
   */
  async getMonthLocks() {
    const { data, error } = await this.db
      .from('month_locks')
      .select('*')
      .order('year_month', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Lock a month (prevent booking for that month).
   */
  async lockMonth(dto: MonthLockDto) {
    const { error } = await this.db
      .from('month_locks')
      .upsert(
        { year_month: dto.yearMonth, is_locked: true },
        { onConflict: 'year_month' },
      );

    if (error) throw error;
    return { message: `Month ${dto.yearMonth} locked` };
  }

  /**
   * Unlock a month (allow booking for that month).
   */
  async unlockMonth(dto: MonthLockDto, userId: string) {
    const { error } = await this.db
      .from('month_locks')
      .upsert(
        {
          year_month: dto.yearMonth,
          is_locked: false,
          unlocked_by: userId,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: 'year_month' },
      );

    if (error) throw error;
    return { message: `Month ${dto.yearMonth} unlocked` };
  }

  /**
   * Get time slots reference data (static, for frontend grid rendering).
   */
  async getTimeSlots() {
    const { data, error } = await this.db
      .from('time_slots')
      .select('*')
      .order('slot_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
