// src/modules/products/dto/create-product.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsIn, Min, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Yonex Aerosensa 50' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Premium feather shuttlecock' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['equipment', 'refreshment', 'merchandise', 'rental', 'other'] })
  @IsIn(['equipment', 'refreshment', 'merchandise', 'rental', 'other'])
  @IsOptional()
  category?: string;

  @ApiProperty({ example: 350000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQty?: number;

  @ApiPropertyOptional({ example: 'SHT-AS50' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
