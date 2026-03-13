// src/modules/shifts/dto/update-shift.dto.ts

import { OmitType, PartialType, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CreateShiftDto, ShiftStatus } from './create-shift.dto';

/**
 * DTO for updating a shift (admin only).
 * Assignments are managed via separate assign/unassign endpoints.
 */
export class UpdateShiftDto extends PartialType(
  OmitType(CreateShiftDto, ['staffIds'] as const),
) {}

export class UpdateShiftStatusDto {
  @ApiProperty({ enum: ShiftStatus, description: 'Force shift status' })
  @IsEnum(ShiftStatus)
  @IsNotEmpty()
  status!: ShiftStatus;
}
