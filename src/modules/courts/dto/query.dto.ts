// src/modules/courts/dto/query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CourtType } from './court.dto';

/**
 * Query DTO for the courts list endpoint.
 * All parameters are optional and additive (AND logic).
 */
export class CourtQueryDto {
  @ApiPropertyOptional({ enum: CourtType, description: 'Filter by court type' })
  @IsEnum(CourtType)
  @IsOptional()
  type?: CourtType;

  @ApiPropertyOptional({ description: 'Filter by active status', type: Boolean })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by court name', example: 'Court A' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
