// src/modules/bookings/dto/create-booking.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Regex for HH:MM time format */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Service/product line item to attach to a booking at creation.
 */
export class BookingServiceItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * DTO for creating a new booking from the overview grid.
 *
 * Customer resolution:
 * - If `customerId` is provided, use it directly.
 * - Otherwise, look up by `customerPhone`.
 *   If not found, auto-create with `customerName` + `customerPhone`.
 */
export class CreateBookingDto {
  @ApiProperty({ description: 'Court UUID' })
  @IsUUID('4')
  courtId!: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ example: '08:00', description: 'Start time (HH:MM)' })
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @ApiProperty({ example: '10:00', description: 'End time (HH:MM), must be after startTime' })
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  endTime!: string;

  @ApiPropertyOptional({ description: 'Existing customer UUID' })
  @IsUUID('4')
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Customer phone (for lookup or auto-create)' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Customer name (for auto-create)' })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({ example: 0, description: 'Amount already paid (VND)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: [BookingServiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceItemDto)
  @IsOptional()
  services?: BookingServiceItemDto[];
}
