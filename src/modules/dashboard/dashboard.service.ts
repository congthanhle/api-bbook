// src/modules/dashboard/dashboard.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

/**
 * Service for dashboard analytics — revenue, occupancy, and business metrics.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns revenue statistics for a given date range.
   * Uses a raw SQL query for aggregation.
   *
   * @param startDate - Start of range (ISO date)
   * @param endDate   - End of range (ISO date)
   */
  async getRevenue(startDate: string, endDate: string) {
    const client = this.supabase.getClient(true);

    const { data: bookings, error } = await client
      .from('bookings')
      .select('total_amount, booking_date, payment_status')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['confirmed', 'checked_in', 'completed']);

    if (error) {
      this.logger.error(`Failed to fetch revenue data: ${error.message}`);
      throw error;
    }

    const totalRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount), 0);
    const paidRevenue = (bookings || [])
      .filter((b) => b.payment_status === 'paid')
      .reduce((sum, b) => sum + Number(b.total_amount), 0);
    const pendingRevenue = totalRevenue - paidRevenue;
    const bookingCount = (bookings || []).length;

    return {
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      bookingCount,
      averageBookingValue: bookingCount > 0 ? Math.round(totalRevenue / bookingCount) : 0,
    };
  }

  /**
   * Returns court occupancy rates for a given date range.
   */
  async getOccupancy(startDate: string, endDate: string) {
    const client = this.supabase.getClient(true);

    const [courtsResult, bookingsResult] = await Promise.all([
      client.from('courts').select('id, name').eq('is_active', true),
      client
        .from('bookings')
        .select('court_id, duration_hours')
        .gte('booking_date', startDate)
        .lte('booking_date', endDate)
        .in('status', ['confirmed', 'checked_in', 'completed']),
    ]);

    const courts = courtsResult.data || [];
    const bookings = bookingsResult.data || [];

    // Calculate total available hours (assume 16 hours/day per court)
    const daysDiff = Math.max(1,
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const hoursPerDay = 16;

    const occupancy = courts.map((court) => {
      const courtBookings = bookings.filter((b) => b.court_id === court.id);
      const bookedHours = courtBookings.reduce((sum, b) => sum + Number(b.duration_hours), 0);
      const totalAvailable = daysDiff * hoursPerDay;
      const rate = totalAvailable > 0 ? Math.round((bookedHours / totalAvailable) * 100) : 0;

      return {
        courtId: court.id,
        courtName: court.name,
        bookedHours,
        totalAvailableHours: totalAvailable,
        occupancyRate: rate,
      };
    });

    return {
      dateRange: { startDate, endDate, days: daysDiff },
      courts: occupancy,
      averageOccupancy: occupancy.length > 0
        ? Math.round(occupancy.reduce((sum, c) => sum + c.occupancyRate, 0) / occupancy.length)
        : 0,
    };
  }
}
