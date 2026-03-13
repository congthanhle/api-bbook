// src/modules/shifts/dto/create-shift.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsDateString,
  Matches,
  IsEnum
} from 'class-validator';

/**
 * Shift status lifecycle.
 */
export enum ShiftStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * DTO for creating a new shift (admin only).
 */
export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift', description: 'Shift name' })
  @IsString()
  @IsNotEmpty({ message: 'Shift name is required' })
  name!: string;

  @ApiProperty({ example: '2026-03-15', description: 'Shift date (ISO date string)' })
  @IsDateString({}, { message: 'Date must be a valid ISO date string' })
  date!: string;

  @ApiProperty({ example: '08:00', description: 'Start time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Start time must be in HH:mm format' })
  startTime!: string;

  @ApiProperty({ example: '16:00', description: 'End time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'End time must be in HH:mm format' })
  endTime!: string;

  @ApiPropertyOptional({ example: 'Opening shift — prepare courts', description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: ['uuid-1', 'uuid-2'],
    description: 'Staff IDs to assign initially',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each staffId must be a valid UUID' })
  @IsOptional()
  staffIds?: string[];
  
  @ApiPropertyOptional({ enum: ShiftStatus, description: 'Force shift status' })
  @IsEnum(ShiftStatus)
  @IsOptional()
  status?: ShiftStatus;
}
