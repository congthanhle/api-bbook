// src/common/exceptions/invalid-status-transition.exception.ts

import { BadRequestException } from '@nestjs/common';

/**
 * Thrown when a booking status transition is not allowed.
 */
export class InvalidStatusTransitionException extends BadRequestException {
  constructor(from: string, to: string) {
    super({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Invalid status transition: ${from} → ${to}`,
      details: { from, to },
    });
  }
}
