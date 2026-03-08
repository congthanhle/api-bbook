// src/config/jwt.config.ts

import { registerAs } from '@nestjs/config';

/**
 * JWT authentication configuration loaded from environment variables.
 * Registered under the `jwt` namespace.
 */
export default registerAs('jwt', () => ({
  /** Secret key for signing JWT tokens */
  secret: process.env['JWT_SECRET'] || 'change-me-in-production',

  /** Token expiration time (e.g. '7d', '1h', '3600s') */
  expiresIn: process.env['JWT_EXPIRES_IN'] || '8h',
}));
