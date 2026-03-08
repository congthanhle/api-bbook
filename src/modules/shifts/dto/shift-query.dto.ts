// src/modules/shifts/dto/shift-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, IsUUID, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftStatus } from './create-shift.dto';

/**
 * Query DTO for listing/filtering shifts.
 */
export class ShiftQueryDto {
  @ApiPropertyOptional({ example: '2026-03-15', description: 'Filter by exact date' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: '2026-03', description: 'Filter by month (YYYY-MM)' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Month must be in YYYY-MM format' })
  @IsOptional()
  month?: string;

  @ApiPropertyOptional({ description: 'Filter by staff ID' })
  @IsUUID('4')
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ enum: ShiftStatus, description: 'Filter by shift status' })
  @IsEnum(ShiftStatus)
  @IsOptional()
  status?: ShiftStatus;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10, description: 'Items per page' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
