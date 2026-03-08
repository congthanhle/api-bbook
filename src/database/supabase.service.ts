// src/database/supabase.service.ts

import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../config/supabase.config';

/**
 * Singleton service that provides access to two Supabase clients:
 *
 * 1. **client** (anon key) — respects Row-Level Security policies.
 *    Use for authenticated user operations.
 *
 * 2. **adminClient** (service-role key) — bypasses RLS.
 *    Use for admin/system operations only.
 *
 * The service performs a health check on startup to verify connectivity.
 *
 * @example
 * ```ts
 * // In a service constructor
 * constructor(private readonly supabase: SupabaseService) {}
 *
 * // Use RLS-aware client
 * const { data } = await this.supabase.getClient().from('courts').select('*');
 *
 * // Use admin client (bypass RLS)
 * const { data } = await this.supabase.getClient(true).from('users').select('*');
 * ```
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);

  /** RLS-aware client (uses anon key) */
  private client!: SupabaseClient;

  /** Admin client (uses service-role key, bypasses RLS) */
  private adminClient!: SupabaseClient;

  constructor(
    @Inject(supabaseConfig.KEY)
    private readonly config: ConfigType<typeof supabaseConfig>,
  ) {}

  /**
   * Initialises both Supabase clients and runs a health check.
   * Called automatically by NestJS after the module is fully initialised.
   */
  async onModuleInit(): Promise<void> {
    const { url, anonKey, serviceRoleKey } = this.config;

    if (!url || !anonKey) {
      this.logger.warn(
        'Supabase URL or anon key not configured. Database features will not work.',
      );
      return;
    }

    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    if (serviceRoleKey) {
      this.adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.logger.warn(
        'Supabase service-role key not configured. Admin client will fall back to anon client.',
      );
      this.adminClient = this.client;
    }

    await this.healthCheck();
  }

  /**
   * Returns a Supabase client instance.
   *
   * @param useAdmin - If `true`, returns the admin client that bypasses RLS.
   *                   Defaults to `false` (uses the anon/RLS-aware client).
   * @returns SupabaseClient instance
   */
  getClient(useAdmin = false): SupabaseClient {
    return useAdmin ? this.adminClient : this.client;
  }

  /**
   * Performs a lightweight health check by querying the Supabase REST API.
   * Logs the result — does NOT throw on failure so the app can still start.
   */
  private async healthCheck(): Promise<void> {
    try {
      const { error } = await this.client.from('_health_check').select('*').limit(1);

      // It's fine if the table doesn't exist — we just want to verify connectivity
      if (error && !error.message.includes('does not exist')) {
        this.logger.warn(`Supabase health check warning: ${error.message}`);
      } else {
        this.logger.log('✅ Supabase connection established successfully');
      }
    } catch (err) {
      this.logger.error(
        `❌ Supabase health check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
