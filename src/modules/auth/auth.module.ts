// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication module.
 *
 * - Registers Passport with 'jwt' as the default strategy.
 * - Configures JwtModule asynchronously from ConfigService.
 * - Exports JwtStrategy so the global JwtAuthGuard (in AppModule) works.
 *
 * Global guards (JwtAuthGuard, RolesGuard, ThrottlerGuard) are
 * registered in `AppModule` via APP_GUARD, not here, to avoid
 * circular dependencies.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '8h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
