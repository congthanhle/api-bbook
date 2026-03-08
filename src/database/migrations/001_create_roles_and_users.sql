-- ============================================================
-- 001_create_roles_and_users.sql
-- Extensions, ENUM types, and users table (extends auth.users)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- needed for exclusion constraints later

-- ── ENUM Types ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE slot_status AS ENUM ('available', 'booked', 'locked', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE court_type AS ENUM ('badminton', 'pickleball', 'tennis', 'futsal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE day_type AS ENUM ('weekday', 'weekend', 'holiday', 'specific_date');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM ('upcoming', 'ongoing', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE membership_tier AS ENUM ('regular', 'silver', 'gold', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM (
    'equipment_rental', 'beverage', 'snack',
    'shuttle_cock', 'coaching', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE salary_type AS ENUM ('monthly', 'hourly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Shared updated_at trigger function ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Users table (extends Supabase auth.users) ───────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT UNIQUE,
  avatar_url  TEXT,
  role        user_role NOT NULL DEFAULT 'staff',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_phone     ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
