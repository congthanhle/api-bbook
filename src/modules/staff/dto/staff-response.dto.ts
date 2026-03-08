// src/modules/staff/dto/staff-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryType } from './create-staff.dto';

/**
 * Full staff response — returned to admin users.
 * Includes all sensitive fields (salary, bank, identity).
 */
export class AdminStaffResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiProperty() role!: string;
  @ApiProperty() isActive!: boolean;

  // Employment
  @ApiProperty() salary!: number;
  @ApiProperty({ enum: SalaryType }) salaryType!: SalaryType;
  @ApiProperty() hireDate!: string;
  @ApiPropertyOptional() notes?: string;

  // Bank
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() bankAccountNumber?: string;
  @ApiPropertyOptional() bankAccountName?: string;

  // Identity
  @ApiPropertyOptional() idCardNumber?: string;
  @ApiPropertyOptional() address?: string;

  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() updatedAt?: string;
}

/**
 * Staff own response — returned to staff-role users.
 * Omits salary, bank account number, and ID card number.
 */
export class StaffOwnResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiProperty() role!: string;
  @ApiProperty() isActive!: boolean;

  // Employment (limited)
  @ApiProperty() hireDate!: string;
  @ApiPropertyOptional() notes?: string;

  // Bank (limited)
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() bankAccountName?: string;

  // Identity (limited)
  @ApiPropertyOptional() address?: string;

  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() updatedAt?: string;
}
