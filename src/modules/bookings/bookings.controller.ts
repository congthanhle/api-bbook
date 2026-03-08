// src/modules/bookings/bookings.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  BookingQueryDto,
  UpdateBookingStatusDto,
  CancelBookingDto,
  UpdatePaymentDto,
  AddServiceDto,
} from './dto';
import { CurrentUser, Roles } from '../../common/decorators';

/**
 * Bookings controller — handles booking CRUD, status transitions,
 * services, and payments.
 *
 * All endpoints require authentication (global JwtAuthGuard).
 */
@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ── CRUD ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List bookings with filters' })
  @ApiResponse({ status: 200, description: 'Paginated booking list' })
  findAll(@Query() query: BookingQueryDto) {
    return this.bookingsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Booking with customer, court, and services' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'staff')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // Limit to 20 req/min
  @ApiOperation({ summary: 'Create a new booking (from overview grid)' })
  @ApiResponse({ status: 201, description: 'Booking created with slot reservation' })
  @ApiResponse({ status: 409, description: 'One or more slots not available' })
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.create(dto, userId);
  }

  // ── Status Transitions ────────────────────────────────────

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking (releases slots + restores stock)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 400, description: 'Booking already completed or cancelled' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.cancel(id, dto, userId);
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check in a booking' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Booking checked in' })
  checkIn(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a booking (updates customer stats + tier)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Booking completed' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.complete(id);
  }

  // ── Booking Services ──────────────────────────────────────

  @Post(':id/services')
  @ApiOperation({ summary: 'Add a product/service to a booking' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Service added, total updated' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  addService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddServiceDto,
  ) {
    return this.bookingsService.addService(id, dto);
  }

  @Delete(':id/services/:sid')
  @ApiOperation({ summary: 'Remove a service from a booking (restores stock)' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'sid', type: String, description: 'Booking service UUID' })
  @ApiResponse({ status: 200, description: 'Service removed' })
  removeService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
  ) {
    return this.bookingsService.removeService(id, sid);
  }

  // ── Payment ───────────────────────────────────────────────

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Update booking payment' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Payment updated' })
  updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.bookingsService.updatePayment(id, dto);
  }
}
