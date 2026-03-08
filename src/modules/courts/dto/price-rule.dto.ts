// src/modules/courts/dto/price-rule.dto.ts

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Day type — matches the `day_type` ENUM in the database.
 */
export enum DayType {
  WEEKDAY = 'weekday',
  WEEKEND = 'weekend',
  HOLIDAY = 'holiday',
  SPECIFIC_DATE = 'specific_date',
}

/** Regex for HH:MM time format (00:00 – 23:59) */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * DTO for creating a price rule on a court.
 */
export class CreatePriceRuleDto {
  @ApiProperty({ enum: DayType, example: DayType.WEEKDAY })
  @IsEnum(DayType, { message: 'dayType must be one of: weekday, weekend, holiday, specific_date' })
  dayType!: DayType;

  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'Required when dayType = specific_date',
  })
  @IsDateString({}, { message: 'specificDate must be a valid ISO date string' })
  @IsOptional()
  specificDate?: string;

  @ApiProperty({ example: '06:00', description: 'Start time (HH:MM)' })
  @Matches(TIME_REGEX, { message: 'timeStart must be in HH:MM format (e.g. 06:00)' })
  timeStart!: string;

  @ApiProperty({ example: '17:00', description: 'End time (HH:MM), must be after timeStart' })
  @Matches(TIME_REGEX, { message: 'timeEnd must be in HH:MM format (e.g. 17:00)' })
  timeEnd!: string;

  @ApiProperty({ example: 120000, description: 'Price per hour in VND (minimum 1000₫)' })
  @IsInt({ message: 'Price must be an integer (VND)' })
  @Min(1000, { message: 'Price must be at least 1,000₫' })
  price!: number;
}

/**
 * DTO for updating a price rule.
 */
export class UpdatePriceRuleDto extends PartialType(CreatePriceRuleDto) {}

/**
 * DTO for bulk-upserting price rules on a court.
 */
export class BulkUpdatePricesDto {
  @ApiProperty({ type: [CreatePriceRuleDto], description: 'Array of price rules to upsert' })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one price rule is required' })
  @ValidateNested({ each: true })
  @Type(() => CreatePriceRuleDto)
  rules!: CreatePriceRuleDto[];
}
