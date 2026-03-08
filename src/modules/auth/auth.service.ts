// src/modules/auth/auth.service.ts

import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../../database/supabase.service';
import { LoginDto, RegisterDto, ChangePasswordDto, UserRole } from './dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Auth service — handles all authentication logic via Supabase
 * auth + custom JWT signing for the CourtOS backend.
 *
 * Flow overview:
 * 1. `login()` — verify credentials via Supabase → sign custom JWT
 * 2. `register()` — admin creates user via adminClient → insert into public.users
 * 3. `logout()` — sign out from Supabase session
 * 4. `refreshToken()` — refresh Supabase session → sign new custom JWT
 * 5. `getProfile()` — fetch user + staff_profiles join
 * 6. `changePassword()` — re-authenticate then update via adminClient
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly TOKEN_EXPIRES_IN = 28_800; // 8 hours in seconds

  constructor(
    private readonly jwtService: JwtService,
    private readonly supabase: SupabaseService,
  ) {}

  // ──────────────────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────────────────

  /**
   * Authenticates a user with email + password via Supabase,
   * then issues a custom JWT containing { sub, email, role }.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // 1. Authenticate via Supabase
    const client = this.supabase.getClient(false);
    const { data: authData, error: authError } =
      await client.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (authError || !authData.user) {
      this.logger.warn(`Login failed for ${dto.email}: ${authError?.message}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Fetch user profile from public.users
    const adminClient = this.supabase.getClient(true);
    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .select('id, name, role, avatar_url, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      this.logger.error(`Profile not found for authenticated user ${authData.user.id}`);
      throw new UnauthorizedException('User profile not found');
    }

    if (!profile.is_active) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // 3. Sign custom JWT
    const payload: JwtPayload = {
      sub: profile.id,
      email: dto.email,
      role: profile.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      expires_in: this.TOKEN_EXPIRES_IN,
      user: {
        id: profile.id,
        name: profile.name,
        email: dto.email,
        role: profile.role,
        avatarUrl: profile.avatar_url,
      },
    };
  }

  // ──────────────────────────────────────────────────────────
  // REGISTER (admin-only)
  // ──────────────────────────────────────────────────────────

  /**
   * Creates a new user account. Only accessible by admins.
   *
   * 1. Creates auth user via Supabase admin API (auto-confirms email).
   * 2. Inserts a row into public.users with role + name.
   *    (The `handle_new_user()` trigger may also fire, but we
   *     do an explicit insert + ON CONFLICT to ensure correctness.)
   */
  async register(dto: RegisterDto) {
    const adminClient = this.supabase.getClient(true);

    // 1. Create auth user
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          name: dto.name,
          role: dto.role || UserRole.STAFF,
        },
      });

    if (authError) {
      this.logger.error(`Registration failed: ${authError.message}`);
      if (authError.message.includes('already been registered')) {
        throw new ConflictException('A user with this email already exists');
      }
      throw new InternalServerErrorException('Failed to create user account');
    }

    // 2. Upsert into public.users (trigger may have created the row)
    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .upsert(
        {
          id: authData.user.id,
          name: dto.name,
          phone: dto.phone || null,
          role: dto.role || UserRole.STAFF,
        },
        { onConflict: 'id' },
      )
      .select('id, name, phone, role, avatar_url, created_at')
      .single();

    if (profileError) {
      this.logger.error(`Failed to create profile: ${profileError.message}`);
      // Roll back: delete the auth user we just created
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw new InternalServerErrorException('Failed to create user profile');
    }

    return {
      id: profile.id,
      name: profile.name,
      email: dto.email,
      phone: profile.phone,
      role: profile.role,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at,
    };
  }

  // ──────────────────────────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────────────────────────

  /**
   * Signs out the user from Supabase (invalidates refresh token).
   * The JWT itself remains valid until expiry — client should discard it.
   */
  async logout(): Promise<{ message: string }> {
    const client = this.supabase.getClient(false);
    await client.auth.signOut();
    return { message: 'Logged out successfully' };
  }

  // ──────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ──────────────────────────────────────────────────────────

  /**
   * Exchanges a Supabase refresh token for a new session,
   * then signs a fresh custom JWT.
   */
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    const client = this.supabase.getClient(false);

    const { data: session, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !session.user) {
      this.logger.warn(`Token refresh failed: ${error?.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Fetch profile
    const adminClient = this.supabase.getClient(true);
    const { data: profile } = await adminClient
      .from('users')
      .select('id, name, role, avatar_url, is_active')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_active) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    const payload: JwtPayload = {
      sub: profile.id,
      email: session.user.email!,
      role: profile.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      expires_in: this.TOKEN_EXPIRES_IN,
      user: {
        id: profile.id,
        name: profile.name,
        email: session.user.email!,
        role: profile.role,
        avatarUrl: profile.avatar_url,
      },
    };
  }

  // ──────────────────────────────────────────────────────────
  // GET PROFILE
  // ──────────────────────────────────────────────────────────

  /**
   * Fetches the authenticated user's profile, LEFT JOINing
   * staff_profiles for staff-specific data.
   */
  async getProfile(userId: string) {
    const adminClient = this.supabase.getClient(true);

    const { data: user, error } = await adminClient
      .from('users')
      .select(
        `
        id, name, phone, avatar_url, role, is_active, created_at, updated_at,
        staff_profiles (
          id, salary, salary_type, hire_date,
          bank_name, bank_account_number, bank_account_name
        )
      `,
      )
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }

    // Also fetch email from Supabase auth
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId);

    return {
      id: user.id,
      name: user.name,
      email: authUser?.user?.email || null,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      staffProfile: user.staff_profiles || null,
    };
  }

  // ──────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ──────────────────────────────────────────────────────────

  /**
   * Changes the authenticated user's password.
   *
   * 1. Re-authenticates with old password to verify identity.
   * 2. Updates password via Supabase admin API.
   */
  async changePassword(
    userId: string,
    userEmail: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const client = this.supabase.getClient(false);

    // 1. Verify old password by re-authenticating
    const { error: verifyError } = await client.auth.signInWithPassword({
      email: userEmail,
      password: dto.oldPassword,
    });

    if (verifyError) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 2. Update password via admin client
    const adminClient = this.supabase.getClient(true);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: dto.newPassword },
    );

    if (updateError) {
      this.logger.error(`Password change failed for ${userId}: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to update password');
    }

    return { message: 'Password changed successfully' };
  }
}
