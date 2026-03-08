// src/common/filters/global-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiErrorResponse } from '../interfaces';

/**
 * Global exception filter that catches ALL exceptions (not just HttpExceptions)
 * and normalises them into the standard error response format.
 *
 * Response shape:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": 500,
 *     "message": "Internal Server Error",
 *     "details": { ... }
 *   }
 * }
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res['message'] as string) || message;
        details = res['details'] || res['error'] || undefined;

        // class-validator returns message as an array
        if (Array.isArray(res['message'])) {
          message = 'Validation failed';
          details = res['message'];
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
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
