// src/modules/products/dto/update-stock.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({ example: 10, description: 'New stock quantity' })
  @IsNumber()
  stockQty!: number;
}
