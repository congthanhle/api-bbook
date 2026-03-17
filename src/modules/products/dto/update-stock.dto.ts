// src/modules/products/dto/update-stock.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStockDto {
  @ApiPropertyOptional({ example: 10, description: 'New stock quantity' })
  @IsNumber()
  @IsOptional()
  stockQty?: number;

  @ApiPropertyOptional({ example: 5, description: 'Stock adjustment (positive or negative)' })
  @IsNumber()
  @IsOptional()
  adjustment?: number;

  @ApiPropertyOptional({ example: 'Restock', description: 'Reason for adjustment' })
  @IsString()
  @IsOptional()
  reason?: string;
}
