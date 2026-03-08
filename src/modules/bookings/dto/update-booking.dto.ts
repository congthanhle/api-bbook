// src/modules/bookings/dto/update-booking.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * DTO for updating booking status.
 */
export class UpdateBookingStatusDto {
  @ApiProperty({
    enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'],
  })
  @IsIn(['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'])
  @IsNotEmpty()
  status!: string;
}

/**
 * DTO for cancelling a booking.
 */
export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer no-show' })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * DTO for updating payment information.
 */
export class UpdatePaymentDto {
  @ApiProperty({ example: 240000, description: 'Amount paid (VND)' })
  @IsInt()
  @Min(0)
  paidAmount!: number;

  @ApiPropertyOptional({ enum: ['unpaid', 'partial', 'paid'] })
  @IsIn(['unpaid', 'partial', 'paid'])
  @IsOptional()
  paymentStatus?: string;
}

/**
 * DTO for adding a service/product to a booking.
 */
export class AddServiceDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
