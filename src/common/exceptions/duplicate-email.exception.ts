// src/common/exceptions/duplicate-email.exception.ts

import { ConflictException } from '@nestjs/common';

/**
 * Thrown when attempting to create a staff member with an email that already exists.
 */
export class DuplicateEmailException extends ConflictException {
  constructor(email: string) {
    super({
      code: 'DUPLICATE_EMAIL',
      message: `A user with email "${email}" already exists`,
    });
  }
}
