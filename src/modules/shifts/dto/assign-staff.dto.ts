// src/modules/shifts/dto/assign-staff.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * DTO for assigning staff members to a shift (admin only).
 */
export class AssignStaffDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Staff IDs to assign to the shift',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one staff ID is required' })
  @IsUUID('4', { each: true, message: 'Each staffId must be a valid UUID' })
  staffIds!: string[];
}
