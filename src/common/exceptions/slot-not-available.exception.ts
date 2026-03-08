// src/common/exceptions/slot-not-available.exception.ts

import { ConflictException } from '@nestjs/common';

export interface SlotConflict {
  timeSlotId: string;
  label: string;
  status: string;
  bookingCode?: string;
}

/**
 * Thrown when one or more time slots are not available for booking.
 */
export class SlotNotAvailableException extends ConflictException {
  constructor(conflicts: SlotConflict[]) {
    super({
      code: 'SLOT_NOT_AVAILABLE',
      message: 'One or more slots are not available',
      details: { conflicts },
    });
  }
}
