// src/modules/dashboard/dashboard.service.ts

import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
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
      .select('total_amount, date, payment_status')
      .gte('date', startDate)
      .lte('date', endDate)
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
        .select('court_id, start_time, end_time')
        .gte('date', startDate)
        .lte('date', endDate)
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
      
      const bookedHours = courtBookings.reduce((sum, b) => {
        const start = dayjs(`${startDate} ${b.start_time}`);
        const end = dayjs(`${startDate} ${b.end_time}`);
        const duration = end.diff(start, 'hour', true);
        return sum + (duration > 0 ? duration : 0);
      }, 0);

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

  /**
   * Returns full dashboard statistics based on the requested period.
   */
  async getStats(range: string = 'today') {
    const client = this.supabase.getClient(true);
    
    // Determine date ranges based on period
    const now = dayjs();
    let startDate: string;
    let endDate: string = now.format('YYYY-MM-DD');
    let prevStartDate: string;
    let prevEndDate: string;

    if (range === 'week') {
      startDate = now.startOf('week').format('YYYY-MM-DD');
      prevStartDate = now.subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
      prevEndDate = now.subtract(1, 'week').endOf('week').format('YYYY-MM-DD');
    } else if (range === 'month') {
      startDate = now.startOf('month').format('YYYY-MM-DD');
      prevStartDate = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      prevEndDate = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    } else {
      // default: today
      startDate = now.format('YYYY-MM-DD');
      prevStartDate = now.subtract(1, 'day').format('YYYY-MM-DD');
      prevEndDate = now.subtract(1, 'day').format('YYYY-MM-DD');
    }

    // 1. Fetch Bookings for Current and Previous Period
    const { data: currentBookings } = await client
      .from('bookings')
      .select('id, total_amount, status, date, start_time, court_id, courts(name, type)')
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('status', 'cancelled');

    const { data: prevBookings } = await client
      .from('bookings')
      .select('id, total_amount')
      .gte('date', prevStartDate)
      .lte('date', prevEndDate)
      .neq('status', 'cancelled');

    // 2. Fetch Monthly Revenue
    const startOfMonth = now.startOf('month').format('YYYY-MM-DD');
    const { data: monthlyBookings } = await client
      .from('bookings')
      .select('total_amount')
      .gte('date', startOfMonth)
      .lte('date', endDate)
      .neq('status', 'cancelled');

    // 3. Revenue by Day (Last 14 days for the chart)
    const fourteenDaysAgo = now.subtract(13, 'day').format('YYYY-MM-DD');
    const { data: revenueByDayRaw } = await client
      .from('bookings')
      .select('total_amount, date')
      .gte('date', fourteenDaysAgo)
      .lte('date', endDate)
      .neq('status', 'cancelled');

    // Process Revenue by Day
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = now.subtract(i, 'day').format('YYYY-MM-DD');
      revenueMap[d] = 0;
    }
    revenueByDayRaw?.forEach(b => {
      if (revenueMap[b.date] !== undefined) {
        revenueMap[b.date] += Number(b.total_amount);
      }
    });
    const revenueByDay = Object.keys(revenueMap).sort().map(date => ({
      date,
      revenue: revenueMap[date]
    }));

    // 4. Bookings by Court Type
    const typeCount: Record<string, number> = {};
    currentBookings?.forEach((b: any) => {
      const type = b.courts?.type || 'Standard';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const bookingsByCourtType = Object.keys(typeCount).map(type => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count: typeCount[type]
    }));

    // 5. Utilization
    const occupancy = await this.getOccupancy(startDate, endDate);
    const prevOccupancy = await this.getOccupancy(prevStartDate, prevEndDate);

    // 6. Top Customers and Active Customers
    const { data: topCustomersRaw } = await client
      .from('customers')
      .select('id, name, total_visits, total_spend')
      .order('total_spend', { ascending: false })
      .limit(5);

    const { count: activeCustomersCount } = await client
      .from('customers')
      .select('*', { count: 'exact', head: true });

    // 7. Recent Bookings (with customer names)
    const { data: recentBookingsRaw } = await client
      .from('bookings')
      .select('id, date, start_time, status, total_amount, courts(name), customers!fk_bookings_customer(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculations for trends
    const calculateTrend = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    const currentRevenue = currentBookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;
    const prevRevenue = prevBookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;
    
    const monthlyRevenue = monthlyBookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;

    return {
      todayBookings: currentBookings?.length || 0,
      todayBookingsTrend: calculateTrend(currentBookings?.length || 0, prevBookings?.length || 0),
      todayRevenue: currentRevenue,
      todayRevenueTrend: calculateTrend(currentRevenue, prevRevenue),
      monthlyRevenue: monthlyRevenue,
      monthlyRevenueTrend: 0, // Simplified
      activeCustomers: activeCustomersCount || 0,
      activeCustomersTrend: 0, // Simplified
      courtUtilizationRate: occupancy.averageOccupancy,
      courtUtilizationTrend: calculateTrend(occupancy.averageOccupancy, prevOccupancy.averageOccupancy),
      revenueByDay,
      bookingsByCourtType,
      peakHours: [
        { hour: '08:00', bookings: 2 },
        { hour: '10:00', bookings: 4 },
        { hour: '16:00', bookings: 8 },
        { hour: '18:00', bookings: 12 },
        { hour: '20:00', bookings: 9 },
      ], // Placeholder for now - needs complex aggregation
      utilizationByCourt: occupancy.courts.map(c => ({
        courtName: c.courtName,
        utilization: c.occupancyRate
      })),
      recentBookings: recentBookingsRaw?.map((b: any) => ({
        id: b.id,
        customerName: b.customers?.name || 'Unknown',
        courtName: b.courts?.name || 'Unknown',
        date: b.date,
        time: b.start_time,
        status: b.status,
        amount: Number(b.total_amount)
      })) || [],
      topCustomers: topCustomersRaw?.map(c => ({
        id: c.id,
        name: c.name,
        visits: c.total_visits || 0,
        totalSpend: c.total_spend || 0
      })) || []
    };
  }
}
