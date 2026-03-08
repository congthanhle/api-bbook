// src/modules/settings/dto/settings.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Matches,
  IsBoolean,
  IsInt,
  Min,
  IsIn,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VenueSettingsDto {
  @ApiProperty({ example: 'CourtOS Arena' })
  @IsString()
  @IsNotEmpty()
  venueName!: string;

  @ApiProperty({ example: '123 Sports Ave' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'contact@courtos.io' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: 'https://storage.../logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;
}

export class OperatingHoursDto {
  @ApiProperty({ example: '06:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:mm format' })
  weekdayOpen!: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:mm format' })
  weekdayClose!: string;

  @ApiProperty({ example: '06:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:mm format' })
  weekendOpen!: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:mm format' })
  weekendClose!: string;
}

export class BookingRulesDto {
  @ApiProperty({ example: 2, description: 'Minimum hours in advance to book' })
  @IsInt()
  @Min(0)
  minAdvanceHours!: number;

  @ApiProperty({ example: 30, description: 'Maximum days in advance to book' })
  @IsInt()
  @Min(1)
  maxAdvanceDays!: number;

  @ApiProperty({ example: 24, description: 'Hours before booking to allow cancellation' })
  @IsInt()
  @Min(0)
  cancellationHours!: number;

  @ApiProperty({ example: true, description: 'Auto lock future months' })
  @IsBoolean()
  autoLockFutureMonths!: boolean;

  @ApiProperty({ example: 60, enum: [30, 60, 90], description: 'Default slot duration in minutes' })
  @IsInt()
  @IsIn([30, 60, 90])
  defaultSlotDuration!: number;
}

export class HolidayDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 'New Year' })
  @IsString()
  @IsOptional()
  name?: string;
}

class NotificationTriggersDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  booking_created!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  booking_cancelled!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  shift_assigned!: boolean;
}

export class NotificationSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  emailEnabled!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  smsEnabled!: boolean;

  @ApiProperty({ type: NotificationTriggersDto })
  @ValidateNested()
  @Type(() => NotificationTriggersDto)
  triggers!: NotificationTriggersDto;
}
