// src/modules/auth/dto/change-password.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for changing the authenticated user's password.
 */
export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass@123', description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  oldPassword!: string;

  @ApiProperty({ example: 'NewPass@456', description: 'New password (min 6 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword!: string;
}
