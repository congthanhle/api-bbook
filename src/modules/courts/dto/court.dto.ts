// src/modules/courts/dto/court.dto.ts

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

/**
 * Court type — matches the `court_type` ENUM in the database.
 */
export enum CourtType {
  BADMINTON = 'badminton',
  PICKLEBALL = 'pickleball',
  TENNIS = 'tennis',
  FUTSAL = 'futsal',
}

/**
 * DTO for creating a new court.
 */
export class CreateCourtDto {
  @ApiProperty({ example: 'Court A1', description: 'Court display name' })
  @IsString()
  @IsNotEmpty({ message: 'Court name is required' })
  name!: string;

  @ApiProperty({ enum: CourtType, example: CourtType.BADMINTON })
  @IsEnum(CourtType, { message: 'Type must be one of: badminton, pickleball, tennis, futsal' })
  type!: CourtType;

  @ApiPropertyOptional({ example: 'Indoor court with LED lighting' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://storage.courtos.io/courts/a1.jpg' })
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @IsOptional()
  imageUrl?: string;
}

/**
 * DTO for updating a court. All fields optional.
 */
export class UpdateCourtDto extends PartialType(CreateCourtDto) {
  @ApiPropertyOptional({ example: true, description: 'Set court active/inactive' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * DTO for court responses including related data counts.
 */
export class CourtResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CourtType }) type!: CourtType;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() priceRulesCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
