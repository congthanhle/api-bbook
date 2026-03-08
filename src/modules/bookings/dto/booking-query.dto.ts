// src/modules/bookings/dto/booking-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
}

/**
 * Query DTO for the bookings list.
 */
export class BookingQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  courtId?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Search by booking code, customer name, or phone' })
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
