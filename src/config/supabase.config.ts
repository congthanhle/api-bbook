// src/config/supabase.config.ts

import { registerAs } from '@nestjs/config';

/**
 * Supabase connection configuration loaded from environment variables.
 * Registered under the `supabase` namespace.
 *
 * Two separate keys are provided:
 * - `anonKey` — for client-side / RLS-enforced queries
 * - `serviceRoleKey` — for admin operations that bypass RLS
 */
export default registerAs('supabase', () => ({
  /** Supabase project URL */
  url: process.env['SUPABASE_URL'] || '',

  /** Supabase anonymous (public) key — subject to RLS */
  anonKey: process.env['SUPABASE_ANON_KEY'] || '',

  /** Supabase service-role key — bypasses RLS (admin only) */
  serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
}));
