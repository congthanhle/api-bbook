-- ============================================================
-- 004_create_bookings.sql
-- Bookings and booking line-item services
-- ============================================================

-- ── Bookings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code        TEXT UNIQUE NOT NULL,    -- auto-generated: BK-YYYYMMDD-XXXX
  court_id            UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL,           -- FK added after customers table (007)
  date                DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  duration_minutes    INTEGER NOT NULL GENERATED ALWAYS AS (
                        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
                      ) STORED,
  total_amount        INTEGER NOT NULL CHECK (total_amount >= 0),
  status              TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled')),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid','partial','paid')),
  paid_amount         INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes               TEXT,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_bookings_time_order CHECK (start_time < end_time),
  CONSTRAINT chk_bookings_paid_le_total CHECK (paid_amount <= total_amount)
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_date ON bookings (court_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer   ON bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_bookings_code       ON bookings (booking_code);

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Now add the FK from court_slot_overrides → bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cso_booking' AND table_name = 'court_slot_overrides'
  ) THEN
    ALTER TABLE court_slot_overrides
      ADD CONSTRAINT fk_cso_booking
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Booking Services (line items) ───────────────────────────
-- Products / services attached to a booking (e.g. shuttle cocks,
-- beverages, coaching). product_id FK is added after products (008).
CREATE TABLE IF NOT EXISTS booking_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL,             -- FK added after products table (008)
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL CHECK (unit_price >= 0),
  subtotal    INTEGER NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_bs_booking ON booking_services (booking_id);
CREATE INDEX IF NOT EXISTS idx_bs_product ON booking_services (product_id);
