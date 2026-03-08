// src/modules/overview/dto/update-slot.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating a single slot's status.
 */
export class UpdateSlotStatusDto {
  @ApiProperty({ example: 'court-uuid' })
  @IsUUID('4')
  courtId!: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ example: 'slot-uuid' })
  @IsUUID('4')
  timeSlotId!: string;

  @ApiProperty({ enum: ['available', 'locked', 'maintenance'] })
  @IsIn(['available', 'locked', 'maintenance'], {
    message: 'status must be available, locked, or maintenance (use bookings API for booked)',
  })
  status!: 'available' | 'locked' | 'maintenance';

  @ApiPropertyOptional({ example: 'Court resurfacing' })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Single slot item within a bulk update.
 */
export class BulkSlotItem {
  @ApiProperty()
  @IsUUID('4')
  courtId!: string;

  @ApiProperty()
  @IsUUID('4')
  timeSlotId!: string;

  @ApiProperty({ enum: ['available', 'locked', 'maintenance'] })
  @IsIn(['available', 'locked', 'maintenance'])
  status!: 'available' | 'locked' | 'maintenance';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * DTO for bulk-updating slot statuses on a given date.
 */
export class BulkUpdateSlotsDto {
  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ type: [BulkSlotItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSlotItem)
  slots!: BulkSlotItem[];
}
