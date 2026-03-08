// src/modules/settings/settings.service.ts

import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import {
  VenueSettingsDto,
  OperatingHoursDto,
  BookingRulesDto,
  HolidayDto,
  NotificationSettingsDto,
} from './dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Helper to fetch a single JSON value from app_settings by key.
   */
  private async getValue<T>(key: string): Promise<T> {
    const { data, error } = await this.supabase
      .getClient(true)
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch setting ${key}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to fetch setting: ${key}`);
    }

    if (!data) {
      throw new NotFoundException(`Setting ${key} not found`);
    }

    return data.value as T;
  }

  /**
   * Helper to upsert a JSON value to app_settings.
   */
  private async updateValue(key: string, value: unknown, userId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient(true)
      .from('app_settings')
      .upsert({
        key,
        value: value as any,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      this.logger.error(`Failed to update setting ${key}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to update setting: ${key}`);
    }
  }

  // ────────────────────────────────────────────────────────
  // AGGREGATE FETCH
  // ────────────────────────────────────────────────────────

  /**
   * Fetches all configuration keys and returns a flattened configuration object.
   */
  async getAllSettings() {
    const { data, error } = await this.supabase
      .getClient(true)
      .from('app_settings')
      .select('key, value');

    if (error) {
      throw new InternalServerErrorException('Failed to fetch settings');
    }

    const settings: Record<string, unknown> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }

    return settings;
  }

  // ────────────────────────────────────────────────────────
  // VENUE INFO
  // ────────────────────────────────────────────────────────

  async getVenueSettings(): Promise<VenueSettingsDto> {
    return this.getValue<VenueSettingsDto>('venue_info');
  }

  async updateVenueSettings(dto: VenueSettingsDto, adminId: string): Promise<VenueSettingsDto> {
    await this.updateValue('venue_info', dto, adminId);
    return dto;
  }

  // ────────────────────────────────────────────────────────
  // OPERATING HOURS
  // ────────────────────────────────────────────────────────

  async getOperatingHours(): Promise<OperatingHoursDto> {
    return this.getValue<OperatingHoursDto>('operating_hours');
  }

  async updateOperatingHours(dto: OperatingHoursDto, adminId: string): Promise<OperatingHoursDto> {
    await this.updateValue('operating_hours', dto, adminId);
    return dto;
  }

  // ────────────────────────────────────────────────────────
  // BOOKING RULES
  // ────────────────────────────────────────────────────────

  async getBookingRules(): Promise<BookingRulesDto> {
    return this.getValue<BookingRulesDto>('booking_rules');
  }

  async updateBookingRules(dto: BookingRulesDto, adminId: string): Promise<BookingRulesDto> {
    await this.updateValue('booking_rules', dto, adminId);
    return dto;
  }

  // ────────────────────────────────────────────────────────
  // HOLIDAYS
  // ────────────────────────────────────────────────────────

  async getHolidays(): Promise<HolidayDto[]> {
    return this.getValue<HolidayDto[]>('holidays');
  }

  async addHoliday(dto: HolidayDto, adminId: string): Promise<HolidayDto[]> {
    const holidays = await this.getHolidays();
    
    // Check if already exists
    if (!holidays.some((h) => h.date === dto.date)) {
      holidays.push(dto);
      
      // Sort chronologically
      holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      await this.updateValue('holidays', holidays, adminId);
    }
    
    return holidays;
  }

  async removeHoliday(date: string, adminId: string): Promise<HolidayDto[]> {
    const holidays = await this.getHolidays();
    const filtered = holidays.filter((h) => h.date !== date);

    if (filtered.length !== holidays.length) {
      await this.updateValue('holidays', filtered, adminId);
    }

    return filtered;
  }

  // ────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ────────────────────────────────────────────────────────

  async getNotificationSettings(): Promise<NotificationSettingsDto> {
    return this.getValue<NotificationSettingsDto>('notifications');
  }

  async updateNotificationSettings(
    dto: NotificationSettingsDto,
    adminId: string,
  ): Promise<NotificationSettingsDto> {
    await this.updateValue('notifications', dto, adminId);
    return dto;
  }
}
