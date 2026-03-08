// src/modules/staff/dto/update-staff.dto.ts

import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateStaffDto } from './create-staff.dto';

/**
 * DTO for admin updating a staff member.
 * All fields from CreateStaffDto except email and password.
 */
export class UpdateStaffDto extends PartialType(
  OmitType(CreateStaffDto, ['email', 'password'] as const),
) {}

/**
 * DTO for staff members updating their own profile.
 * Only phone, address, and avatarUrl are allowed.
 */
export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Q1, TPHCM', description: 'Home address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Avatar URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
