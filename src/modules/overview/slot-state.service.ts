// src/modules/overview/slot-state.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import {
  SlotNotAvailableException,
  SlotConflict,
} from '../../common/exceptions';

/**
 * Time slot record from the `time_slots` table.
 */
export interface TimeSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  slot_order: number;
}

/**
 * Computed status for a single cell in the overview grid.
 */
export interface SlotCell {
  timeSlotId: string;
  label: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'locked' | 'maintenance';
  bookingId?: string | null;
  bookingCode?: string | null;
  customerName?: string | null;
  lockedReason?: string | null;
}

/**
 * Result of validating a time range for booking.
 */
export interface SlotValidationResult {
  available: boolean;
  conflicts: SlotConflict[];
}

/**
 * Shared service for slot state computation and atomic slot updates.
 *
 * Used by both Overview and Bookings modules to ensure consistent
 * slot status logic and atomic booking ↔ slot coordination.
 */
@Injectable()
export class SlotStateService {
  private readonly logger = new Logger(SlotStateService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getClient(true);
  }

  // ──────────────────────────────────────────────────────────
  // SLOT QUERIES
  // ──────────────────────────────────────────────────────────

  /**
   * Get all time slots between startTime and endTime (inclusive of start, exclusive of end).
   * e.g. 08:00–10:00 → returns 4 slots: 08:00, 08:30, 09:00, 09:30
   */
  async getSlotsBetween(startTime: string, endTime: string): Promise<TimeSlot[]> {
    const { data, error } = await this.db
      .from('time_slots')
      .select('*')
      .gte('start_time', startTime)
      .lt('start_time', endTime)
      .order('slot_order', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch time slots: ${error.message}`);
      throw error;
    }

    return (data || []) as TimeSlot[];
  }

  /**
   * Compute the effective status for a single slot on a given date.
   *
   * Priority: booked > locked (override) > month_lock > available
   */
  async computeSlotStatus(
    courtId: string,
    timeSlotId: string,
    date: string,
  ): Promise<SlotCell> {
    // 1. Fetch the time slot info
    const { data: slot } = await this.db
      .from('time_slots')
      .select('*')
      .eq('id', timeSlotId)
      .single();

    if (!slot) {
      throw new Error(`Time slot "${timeSlotId}" not found`);
    }

    // 2. Check court_slot_overrides for this date + slot
    const { data: override } = await this.db
      .from('court_slot_overrides')
      .select('status, booking_id, locked_reason')
      .eq('court_id', courtId)
      .eq('date', date)
      .eq('time_slot_id', timeSlotId)
      .single();

    if (override) {
      // If there's an override, use its status
      let bookingCode: string | null = null;
      let customerName: string | null = null;

      if (override.status === 'booked' && override.booking_id) {
        // Fetch booking details for the grid display
        const { data: booking } = await this.db
          .from('bookings')
          .select('booking_code, customer_id')
          .eq('id', override.booking_id)
          .single();

        if (booking) {
          bookingCode = booking.booking_code;
          const { data: customer } = await this.db
            .from('customers')
            .select('name')
            .eq('id', booking.customer_id)
            .single();
          customerName = customer?.name || null;
        }
      }

      return {
        timeSlotId,
        label: slot.label,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: override.status,
        bookingId: override.booking_id,
        bookingCode,
        customerName,
        lockedReason: override.locked_reason,
      };
    }

    // 3. Check month_locks
    const yearMonth = date.substring(0, 7); // 'YYYY-MM'
    const { data: monthLock } = await this.db
      .from('month_locks')
      .select('is_locked')
      .eq('year_month', yearMonth)
      .single();

    // If month is locked and date is in a future month, default to 'locked'
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isFutureMonth = yearMonth > currentMonth;

    if (monthLock?.is_locked && isFutureMonth) {
      return {
        timeSlotId,
        label: slot.label,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: 'locked',
        lockedReason: 'Month is locked',
      };
    }

    // 4. Default: available
    return {
      timeSlotId,
      label: slot.label,
      startTime: slot.start_time,
      endTime: slot.end_time,
      status: 'available',
    };
  }

  // ──────────────────────────────────────────────────────────
  // SLOT VALIDATION
  // ──────────────────────────────────────────────────────────

  /**
   * Validate that all slots in a time range are available (not booked or locked).
   */
  async validateSlotRange(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<SlotValidationResult> {
    const slots = await this.getSlotsBetween(startTime, endTime);
    const conflicts: SlotConflict[] = [];

    // Batch fetch all overrides for this court + date + slot range
    const slotIds = slots.map((s: TimeSlot) => s.id);
    const { data: overrides } = await this.db
      .from('court_slot_overrides')
      .select('time_slot_id, status, booking_id')
      .eq('court_id', courtId)
      .eq('date', date)
      .in('time_slot_id', slotIds);

    const overrideMap = new Map(
      (overrides || []).map((o: Record<string, unknown>) => [o['time_slot_id'] as string, o]),
    );

    // Check month lock for fallback
    const yearMonth = date.substring(0, 7);
    const { data: monthLock } = await this.db
      .from('month_locks')
      .select('is_locked')
      .eq('year_month', yearMonth)
      .single();

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isFutureMonth = yearMonth > currentMonth;
    const isMonthLocked = monthLock?.is_locked && isFutureMonth;

    for (const slot of slots) {
      const override = overrideMap.get(slot.id) as Record<string, unknown> | undefined;

      if (override) {
        const status = override['status'] as string;
        if (status === 'booked' || status === 'locked' || status === 'maintenance') {
          // Fetch booking code if booked
          let bookingCode: string | undefined;
          if (status === 'booked' && override['booking_id']) {
            const { data: bk } = await this.db
              .from('bookings')
              .select('booking_code')
              .eq('id', override['booking_id'])
              .single();
            bookingCode = bk?.booking_code;
          }

          conflicts.push({
            timeSlotId: slot.id,
            label: slot.label,
            status,
            bookingCode,
          });
        }
      } else if (isMonthLocked) {
        conflicts.push({
          timeSlotId: slot.id,
          label: slot.label,
          status: 'locked',
        });
      }
    }

    return {
      available: conflicts.length === 0,
      conflicts,
    };
  }

  // ──────────────────────────────────────────────────────────
  // SLOT STATE MUTATIONS
  // ──────────────────────────────────────────────────────────

  /**
   * Mark a range of time slots as booked for a booking.
   * Called atomically during booking creation.
   *
   * Throws SlotNotAvailableException if any slot is already booked or locked.
   */
  async markSlotsAsBooked(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string,
    userId: string,
  ): Promise<void> {
    // First validate all slots are available
    const validation = await this.validateSlotRange(courtId, date, startTime, endTime);
    if (!validation.available) {
      throw new SlotNotAvailableException(validation.conflicts);
    }

    // Get the slot IDs
    const slots = await this.getSlotsBetween(startTime, endTime);

    // Upsert overrides
    const rows = slots.map((s: TimeSlot) => ({
      court_id: courtId,
      date,
      time_slot_id: s.id,
      status: 'booked',
      booking_id: bookingId,
      locked_by: userId,
    }));

    const { error } = await this.db
      .from('court_slot_overrides')
      .upsert(rows, { onConflict: 'court_id,date,time_slot_id' });

    if (error) {
      this.logger.error(`Failed to mark slots as booked: ${error.message}`);
      throw error;
    }

    this.logger.log(
      `Marked ${rows.length} slots as booked for booking ${bookingId}`,
    );
  }

  /**
   * Release slots back to available after booking cancellation.
   * Only deletes overrides with status='booked' and matching booking_id.
   * Locked overrides (without booking_id) are preserved.
   */
  async releaseBookingSlots(bookingId: string): Promise<void> {
    const { error } = await this.db
      .from('court_slot_overrides')
      .delete()
      .eq('booking_id', bookingId)
      .eq('status', 'booked');

    if (error) {
      this.logger.error(`Failed to release slots for booking ${bookingId}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Released slots for booking ${bookingId}`);
  }
}
