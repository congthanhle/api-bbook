// src/modules/courts/exceptions/court.exceptions.ts

import { NotFoundException, ConflictException } from '@nestjs/common';

/**
 * Thrown when a court is not found by ID.
 */
export class CourtNotFoundException extends NotFoundException {
  constructor(courtId: string) {
    super(`Court with ID "${courtId}" not found`);
  }
}

/**
 * Thrown when a price rule overlaps with an existing rule
 * for the same court and day type.
 */
export class PriceRuleConflictException extends ConflictException {
  constructor(courtId: string, timeStart: string, timeEnd: string) {
    super(
      `Price rule for court "${courtId}" overlaps with an existing rule ` +
        `in the range ${timeStart}–${timeEnd}`,
    );
  }
}
