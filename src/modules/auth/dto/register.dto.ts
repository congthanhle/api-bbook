// src/modules/auth/dto/register.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO for user registration requests.
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@courtos.io', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'secureP@ss1', description: 'Password (min 6 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ example: '+84901234567', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;
}
