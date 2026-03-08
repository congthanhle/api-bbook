// src/common/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by the RolesGuard to read allowed roles.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that sets the allowed roles for a route handler.
 * Used in conjunction with `RolesGuard` to enforce role-based access control.
 *
 * @example
 * ```ts
 * @Roles('admin', 'manager')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('users')
 * findAll() { ... }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
