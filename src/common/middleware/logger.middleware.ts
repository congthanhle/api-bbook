// src/common/middleware/logger.middleware.ts

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;
      const duration = Date.now() - startTime;
      
      // Attempt to extract userId if populated by AuthGuard
      const userId = (request as any).user?.id || (request as any).user?.sub || 'unauthenticated';

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip} - User: ${userId} - ${duration}ms`,
      );
    });

    next();
  }
}
