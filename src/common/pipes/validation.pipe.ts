// src/common/pipes/validation.pipe.ts

import { ValidationPipe as NestValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Pre-configured ValidationPipe with production-grade settings:
 * - `whitelist`: strips properties not in the DTO
 * - `forbidNonWhitelisted`: throws if extra properties are sent
 * - `transform`: auto-transforms payloads to DTO instances
 * - `transformOptions.enableImplicitConversion`: converts primitives
 */
export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
};

/**
 * Factory that creates a configured ValidationPipe instance.
 * Used in `main.ts` for global registration.
 */
export function createValidationPipe(): NestValidationPipe {
  return new NestValidationPipe(validationPipeOptions);
}
