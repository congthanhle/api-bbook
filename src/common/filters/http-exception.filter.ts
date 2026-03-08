// src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiErrorResponse } from '../interfaces';

/**
 * Exception filter that specifically catches HttpExceptions.
 * Useful when you want to apply a filter to specific routes rather than globally.
 *
 * For global use, prefer `GlobalExceptionFilter` which catches all exception types.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let details: unknown = undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(res['message'])) {
        message = 'Validation failed';
        details = res['message'];
      } else if (typeof res['message'] === 'string') {
        message = res['message'];
      }
    }

    this.logger.warn(
      `[${request.method}] ${request.url} → ${status}: ${message}`,
    );

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: status,
        message,
        ...(details !== undefined && { details }),
      },
    };

    response.status(status).json(errorResponse);
  }
}
