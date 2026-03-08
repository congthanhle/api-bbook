// src/modules/auth/dto/auth-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape of the user profile nested inside AuthResponseDto.
 */
export class AuthUserDto {
  @ApiProperty({ example: 'c0a80121-0001-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;

  @ApiProperty({ example: 'admin@courtos.io' })
  email!: string;

  @ApiProperty({ example: 'admin', enum: ['admin', 'staff'] })
  role!: string;

  @ApiProperty({ example: null, nullable: true })
  avatarUrl!: string | null;
}

/**
 * Successful authentication response.
 */
export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  access_token!: string;

  @ApiProperty({ example: 28800, description: 'Token TTL in seconds (8 hours)' })
  expires_in!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

/**
 * DTO for token refresh requests.
 */
export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'Supabase refresh token' })
  refresh_token!: string;
}
