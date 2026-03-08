// src/modules/settings/settings.controller.ts

import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { SettingsService } from './settings.service';
import {
  VenueSettingsDto,
  OperatingHoursDto,
  BookingRulesDto,
  HolidayDto,
  NotificationSettingsDto,
} from './dto';

@ApiTags('Settings')
@ApiBearerAuth()
@Roles('admin') // Entire controller is Admin-only
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all configuration settings at once' })
  @ApiOkResponse({ description: 'A map of all JSON keys' })
  getAll() {
    return this.service.getAllSettings();
  }

  // ── VENUE INFO ──────────────────────────────────────────

  @Get('venue')
  @ApiOperation({ summary: 'Get venue info' })
  getVenue() {
    return this.service.getVenueSettings();
  }

  @Patch('venue')
  @ApiOperation({ summary: 'Update venue info' })
  updateVenue(
    @Body() dto: VenueSettingsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.updateVenueSettings(dto, adminId);
  }

  // ── OPERATING HOURS ─────────────────────────────────────

  @Get('operating-hours')
  @ApiOperation({ summary: 'Get operating hours' })
  getOperatingHours() {
    return this.service.getOperatingHours();
  }

  @Patch('operating-hours')
  @ApiOperation({ summary: 'Update operating hours' })
  updateOperatingHours(
    @Body() dto: OperatingHoursDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.updateOperatingHours(dto, adminId);
  }

  // ── BOOKING RULES ───────────────────────────────────────

  @Get('booking-rules')
  @ApiOperation({ summary: 'Get booking rules' })
  getBookingRules() {
    return this.service.getBookingRules();
  }

  @Patch('booking-rules')
  @ApiOperation({ summary: 'Update booking rules' })
  updateBookingRules(
    @Body() dto: BookingRulesDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.updateBookingRules(dto, adminId);
  }

  // ── HOLIDAYS ────────────────────────────────────────────

  @Get('holidays')
  @ApiOperation({ summary: 'Get holiday dates' })
  getHolidays() {
    return this.service.getHolidays();
  }

  @Post('holidays')
  @ApiOperation({ summary: 'Add a new holiday date' })
  @ApiCreatedResponse({ type: [HolidayDto] })
  addHoliday(
    @Body() dto: HolidayDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.addHoliday(dto, adminId);
  }

  @Delete('holidays/:date')
  @ApiOperation({ summary: 'Remove a holiday date (YYYY-MM-DD)' })
  @ApiOkResponse({ type: [HolidayDto] })
  removeHoliday(
    @Param('date') date: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.removeHoliday(date, adminId);
  }

  // ── NOTIFICATIONS ───────────────────────────────────────

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification settings' })
  getNotifications() {
    return this.service.getNotificationSettings();
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification settings' })
  updateNotifications(
    @Body() dto: NotificationSettingsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.service.updateNotificationSettings(dto, adminId);
  }
}
