// src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 * The user is attached to the request by the JWT strategy after validation.
 *
 * @example
 * ```ts
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserPayload) {
 *   return user;
 * }
 *
 * @Get('profile')
 * getProfileId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as Record<string, unknown> | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
