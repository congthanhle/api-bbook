// src/modules/overview/dto/get-overview.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsArray, IsUUID } from 'class-validator';

/**
 * DTO for fetching the court overview grid for a specific date.
 */
export class GetOverviewDto {
  @ApiProperty({ example: '2026-03-15', description: 'Date to fetch overview for' })
  @IsDateString({}, { message: 'date must be a valid ISO date' })
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by specific court IDs (omit for all active courts)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  courtIds?: string[];
}
