// src/modules/shifts/dto/update-shift.dto.ts

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateShiftDto } from './create-shift.dto';

/**
 * DTO for updating a shift (admin only).
 * Assignments are managed via separate assign/unassign endpoints.
 */
export class UpdateShiftDto extends PartialType(
  OmitType(CreateShiftDto, ['staffIds'] as const),
) {}
