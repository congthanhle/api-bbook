// src/common/exceptions/booking-already-cancelled.exception.ts

import { BadRequestException } from '@nestjs/common';

/**
 * Thrown when trying to modify a booking that is already cancelled or completed.
 */
export class BookingAlreadyCancelledException extends BadRequestException {
  constructor(bookingId: string, status: string) {
    super({
      code: 'BOOKING_ALREADY_CANCELLED',
      message: `Booking "${bookingId}" is already ${status} and cannot be modified`,
      details: { bookingId, status },
    });
  }
}
