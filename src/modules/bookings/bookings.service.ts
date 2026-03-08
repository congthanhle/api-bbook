// src/modules/bookings/bookings.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SlotStateService } from '../overview/slot-state.service';
import {
  CreateBookingDto,
  BookingQueryDto,
  UpdateBookingStatusDto,
  CancelBookingDto,
  UpdatePaymentDto,
  AddServiceDto,
  BookingServiceItemDto,
} from './dto';
import {
  InvalidStatusTransitionException,
  BookingAlreadyCancelledException,
  InsufficientStockException,
} from '../../common/exceptions';
import {
  normalisePagination,
  buildPaginationMeta,
} from '../../common/utils/pagination.helper';

/**
 * Allowed status transitions for bookings.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['completed'],
  completed: [],
  cancelled: [],
};

/** Membership tier thresholds */
const TIER_THRESHOLDS = {
  silver: { visits: 10 },
  gold: { visits: 30 },
  vip: { visits: 100, spend: 50_000_000 }, // 50M VND
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly slotState: SlotStateService,
  ) {}

  private get db() {
    return this.supabase.getClient(true);
  }

  // ═══════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Paginated, filtered list of bookings with customer + court info.
   */
  async findAll(query: BookingQueryDto) {
    const { page, limit, offset } = normalisePagination(query);

    let qb = this.db
      .from('bookings')
      .select(
        `*, customers!fk_bookings_customer(id, name, phone), courts(id, name, type)`,
        { count: 'exact' },
      );

    if (query.dateFrom) qb = qb.gte('date', query.dateFrom);
    if (query.dateTo) qb = qb.lte('date', query.dateTo);
    if (query.courtId) qb = qb.eq('court_id', query.courtId);
    if (query.customerId) qb = qb.eq('customer_id', query.customerId);
    if (query.status) qb = qb.eq('status', query.status);
    if (query.paymentStatus) qb = qb.eq('payment_status', query.paymentStatus);
    if (query.search) {
      qb = qb.or(
        `booking_code.ilike.%${query.search}%`,
      );
    }

    qb = qb
      .order('date', { ascending: false })
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) {
      this.logger.error(`Failed to fetch bookings: ${error.message}`);
      throw error;
    }

    return {
      data: data || [],
      meta: buildPaginationMeta(count || 0, page, limit),
    };
  }

  /**
   * Full booking detail with customer, court, and services.
   */
  async findOne(id: string) {
    const { data, error } = await this.db
      .from('bookings')
      .select(
        `*,
        customers!fk_bookings_customer(id, name, phone, email, membership_tier),
        courts(id, name, type, image_url),
        booking_services(id, product_id, quantity, unit_price, subtotal,
          products!fk_bs_product(id, name, category, unit))`,
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Booking "${id}" not found`);
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE BOOKING (multi-step)
  // ═══════════════════════════════════════════════════════════

  /**
   * Creates a booking with atomic slot reservation.
   *
   * Steps:
   * 1. Resolve customer (by ID, phone lookup, or auto-create)
   * 2. Validate slot availability
   * 3. Calculate price via DB function
   * 4. Generate booking code
   * 5. Insert booking
   * 6. Insert booking services + decrement stock
   * 7. Mark slots as booked
   * 8. Update customer last_visit_at
   */
  async create(dto: CreateBookingDto, userId: string) {
    // Validate time order
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // ── STEP 1: Resolve customer ──
    const customerId = await this.resolveCustomer(dto, userId);

    // ── STEP 2: Validate slot availability ──
    const validation = await this.slotState.validateSlotRange(
      dto.courtId, dto.date, dto.startTime, dto.endTime,
    );

    if (!validation.available) {
      const { SlotNotAvailableException } = await import('../../common/exceptions');
      throw new SlotNotAvailableException(validation.conflicts);
    }

    // ── STEP 3: Calculate price ──
    const { data: courtPrice } = await this.db.rpc('calculate_booking_price', {
      p_court_id: dto.courtId,
      p_date: dto.date,
      p_start: dto.startTime,
      p_end: dto.endTime,
    });

    let servicesTotal = 0;
    if (dto.services && dto.services.length > 0) {
      for (const svc of dto.services) {
        const { data: product } = await this.db
          .from('products')
          .select('price')
          .eq('id', svc.productId)
          .single();
        servicesTotal += (product?.price || 0) * svc.quantity;
      }
    }

    const totalAmount = (courtPrice as number || 0) + servicesTotal;
    const paidAmount = dto.paidAmount || 0;
    const paymentStatus = paidAmount >= totalAmount
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'unpaid';

    // ── STEP 4 + 5: Insert booking (code auto-generated by trigger) ──
    const { data: booking, error: bookingError } = await this.db
      .from('bookings')
      .insert({
        court_id: dto.courtId,
        customer_id: customerId,
        date: dto.date,
        start_time: dto.startTime,
        end_time: dto.endTime,
        total_amount: totalAmount,
        status: 'confirmed',
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        notes: dto.notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      this.logger.error(`Failed to insert booking: ${bookingError?.message}`);
      throw bookingError || new Error('Failed to create booking');
    }

    const bookingId = booking['id'] as string;

    try {
      // ── STEP 6: Insert services + decrement stock ──
      if (dto.services && dto.services.length > 0) {
        await this.insertBookingServices(bookingId, dto.services);
      }

      // ── STEP 7: Mark slots as booked ──
      await this.slotState.markSlotsAsBooked(
        dto.courtId, dto.date, dto.startTime, dto.endTime,
        bookingId, userId,
      );

      // ── STEP 8: Update customer last_visit_at ──
      await this.db
        .from('customers')
        .update({ last_visit_at: dto.date })
        .eq('id', customerId);

    } catch (err) {
      // Rollback: delete the booking
      this.logger.error(`Booking creation failed, rolling back: ${(err as Error).message}`);
      await this.db.from('bookings').delete().eq('id', bookingId);
      // Attempt to restore stock if services were inserted
      await this.restoreServiceStock(bookingId);
      throw err;
    }

    // Return full booking detail
    return this.findOne(bookingId);
  }

  // ═══════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Update booking status with transition validation.
   */
  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.findOne(id);
    const currentStatus = booking['status'] as string;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(dto.status)) {
      throw new InvalidStatusTransitionException(currentStatus, dto.status);
    }

    const { data, error } = await this.db
      .from('bookings')
      .update({ status: dto.status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Cancel a booking: release slots, restore stock.
   */
  async cancel(id: string, dto: CancelBookingDto, userId: string) {
    const booking = await this.findOne(id);
    const status = booking['status'] as string;

    if (status === 'completed' || status === 'cancelled') {
      throw new BookingAlreadyCancelledException(id, status);
    }

    // Update booking status
    const { data, error } = await this.db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: dto.reason || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Release slots
    await this.slotState.releaseBookingSlots(id);

    // Restore product stock
    await this.restoreServiceStock(id);

    return data;
  }

  /**
   * Check in a booking.
   */
  async checkIn(id: string) {
    return this.updateStatus(id, { status: 'checked_in' });
  }

  /**
   * Complete a booking and update customer stats + membership tier.
   */
  async complete(id: string) {
    const result = await this.updateStatus(id, { status: 'completed' });

    // The DB trigger `update_customer_stats` handles total_visits + total_spend.
    // We handle membership tier upgrade here.
    const booking = await this.findOne(id);
    const customerId = booking['customer_id'] as string;

    await this.checkMembershipUpgrade(customerId);

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // BOOKING SERVICES
  // ═══════════════════════════════════════════════════════════

  /**
   * Add a service/product to a booking.
   */
  async addService(bookingId: string, dto: AddServiceDto) {
    const booking = await this.findOne(bookingId);
    const status = booking['status'] as string;

    if (status === 'completed' || status === 'cancelled') {
      throw new BookingAlreadyCancelledException(bookingId, status);
    }

    // Validate product + stock
    const { data: product }: { data: Record<string, unknown> | null } = await this.db
      .from('products')
      .select('id, name, price, stock, is_service, is_active')
      .eq('id', dto.productId)
      .single();

    if (!product || !product['is_active']) {
      throw new NotFoundException(`Product "${dto.productId}" not found or inactive`);
    }

    if (
      !product['is_service'] &&
      product['stock'] !== null &&
      (product['stock'] as number) < dto.quantity
    ) {
      throw new InsufficientStockException(
        product['name'] as string,
        product['stock'] as number,
        dto.quantity,
      );
    }

    const unitPrice = product['price'] as number;
    const subtotal = unitPrice * dto.quantity;

    // Insert booking_service
    const { error: svcError } = await this.db
      .from('booking_services')
      .insert({
        booking_id: bookingId,
        product_id: dto.productId,
        quantity: dto.quantity,
        unit_price: unitPrice,
      });

    if (svcError) throw svcError;

    // Decrement stock if not a service
    if (!product['is_service'] && product['stock'] !== null) {
      const newStock = (product['stock'] as number) - dto.quantity;
      await this.db
        .from('products')
        .update({ stock: newStock })
        .eq('id', dto.productId);
    }

    // Update booking total
    const currentTotal = booking['total_amount'] as number;
    await this.db
      .from('bookings')
      .update({ total_amount: currentTotal + subtotal })
      .eq('id', bookingId);

    return this.findOne(bookingId);
  }

  /**
   * Remove a service from a booking and restore stock.
   */
  async removeService(bookingId: string, serviceId: string) {
    const booking = await this.findOne(bookingId);
    const status = booking['status'] as string;

    if (status === 'completed' || status === 'cancelled') {
      throw new BookingAlreadyCancelledException(bookingId, status);
    }

    // Fetch the service line item
    const { data: svc } = await this.db
      .from('booking_services')
      .select('id, product_id, quantity, unit_price, subtotal')
      .eq('id', serviceId)
      .eq('booking_id', bookingId)
      .single();

    if (!svc) {
      throw new NotFoundException(`Booking service "${serviceId}" not found`);
    }

    // Delete the service
    await this.db.from('booking_services').delete().eq('id', serviceId);

    // Restore stock
    const { data: product } = await this.db
      .from('products')
      .select('stock, is_service')
      .eq('id', svc['product_id'])
      .single();

    if (product && !product['is_service'] && product['stock'] !== null) {
      await this.db
        .from('products')
        .update({ stock: (product['stock'] as number) + (svc['quantity'] as number) })
        .eq('id', svc['product_id']);
    }

    // Update booking total
    const currentTotal = booking['total_amount'] as number;
    await this.db
      .from('bookings')
      .update({ total_amount: currentTotal - (svc['subtotal'] as number) })
      .eq('id', bookingId);

    return this.findOne(bookingId);
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT
  // ═══════════════════════════════════════════════════════════

  /**
   * Update payment information for a booking.
   */
  async updatePayment(id: string, dto: UpdatePaymentDto) {
    const booking = await this.findOne(id);
    const totalAmount = booking['total_amount'] as number;

    if (dto.paidAmount > totalAmount) {
      throw new BadRequestException(
        `Paid amount (${dto.paidAmount}) cannot exceed total (${totalAmount})`,
      );
    }

    // Auto-determine payment status if not explicitly provided
    let paymentStatus = dto.paymentStatus;
    if (!paymentStatus) {
      if (dto.paidAmount >= totalAmount) paymentStatus = 'paid';
      else if (dto.paidAmount > 0) paymentStatus = 'partial';
      else paymentStatus = 'unpaid';
    }

    const { data, error } = await this.db
      .from('bookings')
      .update({
        paid_amount: dto.paidAmount,
        payment_status: paymentStatus,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Resolve customer from DTO: by ID, by phone lookup, or auto-create.
   */
  private async resolveCustomer(dto: CreateBookingDto, userId: string): Promise<string> {
    if (dto.customerId) return dto.customerId;

    if (!dto.customerPhone) {
      throw new BadRequestException('Either customerId or customerPhone is required');
    }

    // Try to find by phone
    const { data: existing } = await this.db
      .from('customers')
      .select('id')
      .eq('phone', dto.customerPhone)
      .single();

    if (existing) return existing['id'] as string;

    // Auto-create
    if (!dto.customerName) {
      throw new BadRequestException(
        'customerName is required when creating a new customer via phone',
      );
    }

    const { data: newCustomer, error } = await this.db
      .from('customers')
      .insert({
        name: dto.customerName,
        phone: dto.customerPhone,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error || !newCustomer) {
      throw new BadRequestException(`Failed to create customer: ${error?.message}`);
    }

    return newCustomer['id'] as string;
  }

  /**
   * Insert booking services and decrement product stock.
   */
  private async insertBookingServices(
    bookingId: string,
    services: BookingServiceItemDto[],
  ): Promise<void> {
    for (const svc of services) {
      const { data: product }: { data: Record<string, unknown> | null } = await this.db
        .from('products')
        .select('id, name, price, stock, is_service, is_active')
        .eq('id', svc.productId)
        .single();

      if (!product || !product['is_active']) {
        throw new NotFoundException(`Product "${svc.productId}" not found or inactive`);
      }

      if (
        !product['is_service'] &&
        product['stock'] !== null &&
        (product['stock'] as number) < svc.quantity
      ) {
        throw new InsufficientStockException(
          product['name'] as string,
          product['stock'] as number,
          svc.quantity,
        );
      }

      // Insert service line item
      await this.db.from('booking_services').insert({
        booking_id: bookingId,
        product_id: svc.productId,
        quantity: svc.quantity,
        unit_price: product['price'] as number,
      });

      // Decrement stock
      if (!product['is_service'] && product['stock'] !== null) {
        const newStock = (product['stock'] as number) - svc.quantity;
        await this.db
          .from('products')
          .update({ stock: newStock })
          .eq('id', svc.productId);
      }
    }
  }

  /**
   * Restore product stock for all services in a booking.
   * Used during cancellation and creation rollback.
   */
  private async restoreServiceStock(bookingId: string): Promise<void> {
    const { data: services } = await this.db
      .from('booking_services')
      .select('product_id, quantity')
      .eq('booking_id', bookingId);

    if (!services || services.length === 0) return;

    for (const svc of services) {
      const { data: product } = await this.db
        .from('products')
        .select('stock, is_service')
        .eq('id', svc['product_id'])
        .single();

      if (product && !product['is_service'] && product['stock'] !== null) {
        await this.db
          .from('products')
          .update({
            stock: (product['stock'] as number) + (svc['quantity'] as number),
          })
          .eq('id', svc['product_id']);
      }
    }
  }

  /**
   * Check and upgrade customer membership tier based on thresholds.
   */
  private async checkMembershipUpgrade(customerId: string): Promise<void> {
    const { data: customer } = await this.db
      .from('customers')
      .select('total_visits, total_spend, membership_tier')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    const visits = customer['total_visits'] as number;
    const spend = customer['total_spend'] as number;
    const currentTier = customer['membership_tier'] as string;

    let newTier = currentTier;

    if (
      visits >= TIER_THRESHOLDS.vip.visits ||
      spend >= TIER_THRESHOLDS.vip.spend
    ) {
      newTier = 'vip';
    } else if (visits >= TIER_THRESHOLDS.gold.visits) {
      newTier = 'gold';
    } else if (visits >= TIER_THRESHOLDS.silver.visits) {
      newTier = 'silver';
    }

    if (newTier !== currentTier) {
      await this.db
        .from('customers')
        .update({ membership_tier: newTier })
        .eq('id', customerId);

      this.logger.log(`Customer ${customerId} upgraded: ${currentTier} → ${newTier}`);
    }
  }
}
