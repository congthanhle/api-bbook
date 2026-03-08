// src/modules/users/dto/create-user.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@courtos.io' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'secureP@ss1' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van B' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ example: '+84901234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: ['admin', 'manager', 'staff', 'customer'], default: 'customer' })
  @IsIn(['admin', 'manager', 'staff', 'customer'])
  @IsOptional()
  role?: string;
}
