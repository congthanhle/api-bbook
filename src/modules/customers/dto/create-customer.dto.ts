// src/modules/customers/dto/create-customer.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsDateString,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '0912345678', description: 'Vietnamese phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, { message: 'Invalid Vietnamese phone number' })
  phone!: string;

  @ApiPropertyOptional({ example: 'customer@courtos.io' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'] })
  @IsIn(['male', 'female', 'other'])
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ example: 'VIP Member', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}
