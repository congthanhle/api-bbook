-- ============================================================
-- 007_create_customers.sql
-- Customer profiles with membership and spend tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE,
  date_of_birth   DATE,
  gender          TEXT CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL),
  membership_tier membership_tier NOT NULL DEFAULT 'regular',
  total_visits    INTEGER NOT NULL DEFAULT 0,
  total_spend     INTEGER NOT NULL DEFAULT 0,  -- VND
  last_visit_at   DATE,
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone      ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_email      ON customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_membership ON customers (membership_tier);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name       ON customers USING gin (name gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Soft delete support
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(membership_tier);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers
  USING gin(to_tsvector('simple', name || ' ' || phone || ' ' || COALESCE(email, '')));

-- Exclude soft-deleted from normal queries
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(created_at)
  WHERE deleted_at IS NULL;

-- Now add the FK from bookings → customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_bookings_customer' AND table_name = 'bookings'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT fk_bookings_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
  END IF;
END $$;
