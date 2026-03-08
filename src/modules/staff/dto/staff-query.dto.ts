// src/modules/staff/dto/staff-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Filter status for staff queries.
 */
export enum StaffStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * Query DTO for listing/searching staff members.
 */
export class StaffQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: StaffStatus, description: 'Filter by status' })
  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus;

  @ApiPropertyOptional({ description: 'Filter by role (admin or staff)' })
  @IsString()
  @IsOptional()
  role?: string;

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
