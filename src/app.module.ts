// src/app.module.ts

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import supabaseConfig from './config/supabase.config';

// Database
import { SupabaseModule } from './database/supabase.module';

// Common
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CourtsModule } from './modules/courts/courts.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { OverviewModule } from './modules/overview/overview.module';
import { StaffModule } from './modules/staff/staff.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './health/health.module';
import { envValidationSchema } from './config/env.validation';

/**
 * Root application module.
 *
 * Global guards are applied in this order:
 * 1. ThrottlerGuard  — rate limiting (per-endpoint overridable)
 * 2. JwtAuthGuard    — JWT verification (opt out with @Public())
 * 3. RolesGuard      — role-based access (opt in with @Roles())
 */
@Module({
  imports: [
    // ── Configuration (global) ────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, supabaseConfig],
      envFilePath: ['.env', '.env.local'],
      validationSchema: envValidationSchema,
    }),

    // ── Rate Limiting ─────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,   // 1 minute window
        limit: 100,    // 100 requests per minute (global default)
      },
    ]),

    // ── Database ──────────────────────────────────────
    SupabaseModule,

    // ── Feature Modules ───────────────────────────────
    AuthModule,
    UsersModule,
    CourtsModule,
    BookingsModule,
    OverviewModule,
    StaffModule,
    ShiftsModule,
    CustomersModule,
    ProductsModule,
    DashboardModule,
    SettingsModule,
    UploadModule,
    HealthModule,
  ],
  providers: [
    // Guard order matters: Throttler → JWT → Roles
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Apply the request logging middleware on all routes.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
