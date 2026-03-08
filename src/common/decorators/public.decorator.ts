// src/common/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by the JwtAuthGuard to skip authentication.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route as publicly accessible, bypassing JWT authentication.
 * Use this on login, registration, and other public endpoints.
 *
 * @example
 * ```ts
 * @Public()
 * @Post('login')
 * login(@Body() dto: LoginDto) { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
