// src/common/exceptions/staff-not-found.exception.ts

import { NotFoundException } from '@nestjs/common';

/**
 * Thrown when a staff member cannot be found by the given identifier.
 */
export class StaffNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      code: 'STAFF_NOT_FOUND',
      message: `Staff member "${id}" not found`,
    });
  }
}
