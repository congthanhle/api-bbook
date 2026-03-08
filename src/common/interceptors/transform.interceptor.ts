// src/common/interceptors/transform.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((result) => {
        // If the result already has data/meta (like from PaginatedResult), just wrap it
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          return {
            success: true,
            data: result.data,
            meta: result.meta,
          };
        }

        // Standard wrapping
        return {
          success: true,
          data: result,
        };
      }),
    );
  }
}
