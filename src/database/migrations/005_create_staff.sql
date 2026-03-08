-- ============================================================
-- 005_create_staff.sql
-- Staff profiles extending the users table with HR data
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  salary              INTEGER,                       -- stored in VND
  salary_type         salary_type NOT NULL DEFAULT 'monthly',
  hire_date           DATE,
  address             TEXT,
  id_card_number      TEXT,
  bank_name           TEXT,
  bank_account_number TEXT,
  bank_account_name   TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON staff_profiles (user_id);

DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
