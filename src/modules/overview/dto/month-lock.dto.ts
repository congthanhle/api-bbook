// src/modules/overview/dto/month-lock.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

/**
 * DTO for locking or unlocking a month.
 */
export class MonthLockDto {
  @ApiProperty({ example: '2026-04', description: 'Year-month in YYYY-MM format' })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'yearMonth must be in YYYY-MM format',
  })
  yearMonth!: string;
}
