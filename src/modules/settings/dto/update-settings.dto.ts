// src/modules/settings/dto/update-settings.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';

/**
 * DTO for updating venue settings. All fields are optional — only provided
 * fields will be updated.
 */
export class UpdateSettingsDto {
  // Venue Info
  @ApiPropertyOptional({ example: 'CourtOS Badminton Center' })
  @IsString() @IsOptional()
  venueName?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Hue, District 1, HCMC' })
  @IsString() @IsOptional()
  venueAddress?: string;

  @ApiPropertyOptional({ example: '+84 28 1234 5678' })
  @IsString() @IsOptional()
  venuePhone?: string;

  @ApiPropertyOptional({ example: 'contact@courtos.io' })
  @IsString() @IsOptional()
  venueEmail?: string;

  // Booking Rules
  @ApiPropertyOptional({ example: 1, description: 'Minimum booking hours' })
  @IsNumber() @Min(0.5) @Max(8) @IsOptional()
  minBookingHours?: number;

  @ApiPropertyOptional({ example: 4, description: 'Maximum booking hours' })
  @IsNumber() @Min(1) @Max(12) @IsOptional()
  maxBookingHours?: number;

  @ApiPropertyOptional({ example: 24, description: 'Hours in advance to cancel' })
  @IsNumber() @Min(0) @IsOptional()
  cancellationHours?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean() @IsOptional()
  allowOnlineBooking?: boolean;

  // Notifications
  @ApiPropertyOptional({ example: true })
  @IsBoolean() @IsOptional()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean() @IsOptional()
  smsNotifications?: boolean;
}
