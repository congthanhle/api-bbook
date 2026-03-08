// src/common/interceptors/transform-response.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PaginationMeta } from '../interfaces';

/**
 * Shape returned by service methods when they include pagination info.
 */
interface PaginatedServiceResponse<T> {
  data: T;
  meta: PaginationMeta;
}

/**
 * Global interceptor that wraps every successful response in the standard
 * API envelope: `{ success: true, data, message?, meta? }`.
 *
 * If the controller returns an object with `data` and `meta` keys
 * (paginated response), they are unpacked into the envelope.
 *
 * @example
 * Controller returns `{ id: 1, name: 'Court A' }`
 * → Client receives `{ success: true, data: { id: 1, name: 'Court A' } }`
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        // Handle paginated responses from services
        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'meta' in responseData
        ) {
          const paginated = responseData as unknown as PaginatedServiceResponse<T>;
          return {
            success: true as const,
            data: paginated.data,
            meta: paginated.meta,
          };
        }

        // Handle responses that already have the message property
        if (
          responseData &&
          typeof responseData === 'object' &&
          'message' in responseData &&
          'data' in responseData
        ) {
          const withMessage = responseData as unknown as {
            data: T;
            message: string;
          };
          return {
            success: true as const,
            data: withMessage.data,
            message: withMessage.message,
          };
        }

        return {
          success: true as const,
          data: responseData,
        };
      }),
    );
  }
}
