// src/main.ts

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

/**
 * Bootstrap the CourtOS Backend application.
 *
 * Sets up:
 * - Helmet & compression middleware
 * - Global validation pipe (whitelist, transform, forbidNonWhitelisted)
 * - Global exception filter (normalised error format)
 * - Global response interceptor (normalised success format)
 * - Swagger / OpenAPI docs at /api/docs
 * - CORS with configurable origins
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', ['http://localhost:3000']);

  // ── Security & Compression ────────────────────────────
  app.use(helmet());
  app.use(compression());

  // ── Global Pipes ──────────────────────────────────────
  app.useGlobalPipes(createValidationPipe());

  // ── Global Filters ────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global Interceptors ───────────────────────────────
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
  );

  // ── CORS ──────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['X-Total-Count'],
  });

  // ── API Prefix ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger / OpenAPI ─────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CourtOS Backend')
      .setDescription('Badminton Court Management System — REST API Documentation')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'access-token',
      )
      .addTag('Auth', 'Authentication & authorization')
      .addTag('Users', 'User management (admin)')
      .addTag('Courts', 'Court management')
      .addTag('Bookings', 'Booking CRUD & status')
      .addTag('Overview', 'Booking overview & today\'s schedule')
      .addTag('Staff', 'Staff management')
      .addTag('Shifts', 'Shift scheduling')
      .addTag('Customers', 'Customer profiles')
      .addTag('Products', 'Product inventory')
      .addTag('Dashboard', 'Analytics & metrics')
      .addTag('Settings', 'Venue settings')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
    });

    logger.log(`📄 Swagger docs available at http://localhost:${port}/api/docs`);
  }

  // ── Start ─────────────────────────────────────────────
  await app.listen(port);
  logger.log(`🚀 CourtOS Backend running on http://localhost:${port} [${nodeEnv}]`);
}

bootstrap();
