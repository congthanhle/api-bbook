// src/modules/auth/strategies/jwt.strategy.ts

import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import jwtConfig from '../../../config/jwt.config';
import { SupabaseService } from '../../../database/supabase.service';

/**
 * JWT payload shape stored inside the access token.
 */
export interface JwtPayload {
  /** User UUID (subject) */
  sub: string;
  /** User email */
  email: string;
  /** User role: 'admin' | 'staff' */
  role: string;
  /** Issued-at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * Passport JWT strategy that:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Verifies signature + expiration against JWT_SECRET.
 * 3. Fetches the full user row from Supabase `public.users`.
 * 4. Attaches the user object to `request.user`.
 *
 * If the user is not found or inactive, throws `UnauthorizedException`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConf: ConfigType<typeof jwtConfig>,
    private readonly supabase: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConf.secret,
    });
  }

  /**
   * Called after the token is decoded and verified.
   * Fetches the full user row from Supabase to ensure the user
   * still exists and is active.
   *
   * @param payload - Decoded JWT payload
   * @returns User object attached to `request.user`
   * @throws UnauthorizedException if user not found or inactive
   */
  async validate(payload: JwtPayload) {
    const { data: user, error } = await this.supabase
      .getClient(true)
      .from('users')
      .select('id, name, phone, avatar_url, role, is_active')
      .eq('id', payload.sub)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    return {
      id: user.id,
      name: user.name,
      email: payload.email,
      role: user.role,
      avatarUrl: user.avatar_url,
    };
  }
}
