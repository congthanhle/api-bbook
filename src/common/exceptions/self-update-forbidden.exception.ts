// src/common/exceptions/self-update-forbidden.exception.ts

import { ForbiddenException } from '@nestjs/common';

/**
 * Thrown when a staff member attempts to update another staff member's profile.
 */
export class SelfUpdateForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: 'SELF_UPDATE_ONLY',
      message: 'Staff members can only update their own profile',
    });
  }
}
