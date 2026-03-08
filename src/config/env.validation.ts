// src/config/env.validation.ts

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:5173'),
});
