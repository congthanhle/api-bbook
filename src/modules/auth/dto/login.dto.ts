// src/modules/auth/dto/login.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * User roles available in the system.
 */
export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
}

/**
 * DTO for user login requests.
 */
export class LoginDto {
  @ApiProperty({ example: 'admin@courtos.io', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'Admin@123', description: 'Password (min 6 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;
}

/**
 * DTO for user registration (admin-only).
 */
export class RegisterDto {
  @ApiProperty({ example: 'staff@courtos.io', description: 'Email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'Staff@123', description: 'Password (min 6 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name (min 2 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: '+84901234567',
    description: 'Phone number (Vietnamese format)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+84|0)(3|5|7|8|9)\d{8}$/, {
    message: 'Phone must be a valid Vietnamese phone number (e.g. +84901234567 or 0901234567)',
  })
  phone?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.STAFF,
    description: 'User role',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either admin or staff' })
  role?: UserRole;
}
