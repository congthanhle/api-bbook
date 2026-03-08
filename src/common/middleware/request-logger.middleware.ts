// src/common/middleware/request-logger.middleware.ts

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that logs every incoming HTTP request with method, URL,
 * and the client IP address. Applied globally in `AppModule.configure()`.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || 'unknown';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get('content-length') || 0;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength}B — ${duration}ms [${ip}] ${userAgent}`,
      );
    });

    next();
  }
}
