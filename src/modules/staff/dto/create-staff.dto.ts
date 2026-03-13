// src/modules/staff/dto/create-staff.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Salary payment type for staff members.
 */
export enum SalaryType {
  MONTHLY = 'monthly',
  HOURLY = 'hourly',
}

/**
 * DTO for creating a new staff member.
 * Admin-only — creates auth user + users row + staff_profiles row.
 */
export class CreateStaffDto {
  // ── Personal ──────────────────────────────────────────

  @ApiProperty({ example: 'staff@courtos.io', description: 'Staff email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'Staff@1234', description: 'Password (min 8 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Avatar URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  // ── Employment ────────────────────────────────────────
  
  @ApiPropertyOptional({ example: 'staff', description: 'Staff role (admin, staff)' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Staff status (active, inactive)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 8000000, description: 'Salary amount (integer)' })
  @IsInt({ message: 'Salary must be an integer' })
  @Min(0, { message: 'Salary must be at least 0' })
  salary!: number;

  @ApiProperty({ enum: SalaryType, example: SalaryType.MONTHLY, description: 'Salary payment type' })
  @IsEnum(SalaryType, { message: 'Salary type must be either monthly or hourly' })
  salaryType!: SalaryType;

  @ApiProperty({ example: '2024-01-15', description: 'Hire date (ISO date string)' })
  @IsDateString({}, { message: 'Hire date must be a valid ISO date string' })
  hireDate!: string;

  @ApiPropertyOptional({ example: 'Experienced coach', description: 'Notes about the staff member' })
  @IsString()
  @IsOptional()
  notes?: string;

  // ── Bank ──────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Vietcombank', description: 'Bank name' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: '0123456789', description: 'Bank account number' })
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'NGUYEN VAN A', description: 'Bank account holder name' })
  @IsString()
  @IsOptional()
  bankAccountName?: string;

  // ── Identity ──────────────────────────────────────────

  @ApiPropertyOptional({ example: '079123456789', description: 'ID card number' })
  @IsString()
  @IsOptional()
  idCardNumber?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Q1, TPHCM', description: 'Home address' })
  @IsString()
  @IsOptional()
  address?: string;
}
