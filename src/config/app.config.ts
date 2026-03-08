// src/config/app.config.ts

import { registerAs } from '@nestjs/config';

/**
 * Application-level configuration loaded from environment variables.
 * Registered under the `app` namespace.
 *
 * @example
 * ```ts
 * constructor(@Inject(appConfig.KEY) private config: ConfigType<typeof appConfig>) {}
 * ```
 */
export default registerAs('app', () => ({
  /** HTTP port the server listens on */
  port: parseInt(process.env['PORT'] || '3000', 10),

  /** Current environment: development | staging | production */
  nodeEnv: process.env['NODE_ENV'] || 'development',

  /** Allowed CORS origins (comma-separated) */
  corsOrigins: [
    ...(process.env['CORS_ORIGINS']
      ? process.env['CORS_ORIGINS'].split(',')
      : ['http://localhost:3000', 'http://localhost:3001']),
    'https://panel-bbook.vercel.app',
  ].map((origin) => origin.trim()),
}));
