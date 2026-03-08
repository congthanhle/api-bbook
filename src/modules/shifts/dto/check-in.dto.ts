// src/modules/shifts/dto/check-in.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for staff check-in to a shift.
 */
export class CheckInDto {
  @ApiPropertyOptional({ example: 'Arrived on time', description: 'Check-in notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
