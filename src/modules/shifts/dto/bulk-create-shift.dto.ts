// src/modules/shifts/dto/bulk-create-shift.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsDateString,
  Matches,
} from 'class-validator';

/**
 * DTO for creating multiple shifts at once via a date range (admin only).
 */
export class BulkCreateShiftDto {
  @ApiProperty({ example: 'Morning Shift', description: 'Shift name' })
  @IsString()
  @IsNotEmpty({ message: 'Shift name is required' })
  name!: string;

  @ApiProperty({ example: '2026-03-15', description: 'Start date of range' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-03-21', description: 'End date of range' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: '08:00', description: 'Start time for all shifts' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Start time must be in HH:mm format' })
  startTime!: string;

  @ApiProperty({ example: '16:00', description: 'End time for all shifts' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'End time must be in HH:mm format' })
  endTime!: string;

  @ApiPropertyOptional({ example: 'Opening shift', description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: ['uuid-1'],
    description: 'Staff IDs to assign to ALL shifts',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  staffIds?: string[];
}
