// src/modules/courts/dto/court-lock.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * DTO for locking or unlocking court time slots over a date range.
 *
 * If `timeSlotIds` is omitted or empty, ALL 32 slots are affected.
 */
export class LockCourtDto {
  @ApiProperty({ example: '2026-03-15', description: 'Start date (inclusive)' })
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  startDate!: string;

  @ApiProperty({ example: '2026-03-17', description: 'End date (inclusive), must be ≥ startDate' })
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
  endDate!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Specific time slot UUIDs to lock. Omit to lock all slots.',
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each timeSlotId must be a valid UUID' })
  @IsOptional()
  timeSlotIds?: string[];

  @ApiPropertyOptional({ example: 'Maintenance - resurfacing court' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ enum: ['lock', 'unlock'], example: 'lock' })
  @IsIn(['lock', 'unlock'], { message: 'action must be either lock or unlock' })
  action!: 'lock' | 'unlock';
}
