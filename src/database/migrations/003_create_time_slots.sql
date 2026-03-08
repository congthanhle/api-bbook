-- ============================================================
-- 003_create_time_slots.sql
-- Lookup time slots (30-min intervals), per-date overrides,
-- and month-level lock table
-- ============================================================

-- ── Time Slots (static lookup) ──────────────────────────────
CREATE TABLE IF NOT EXISTS time_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,              -- e.g. '06:00'
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  slot_order INTEGER NOT NULL,

  CONSTRAINT chk_time_slots_order CHECK (start_time < end_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_time_slots_start ON time_slots (start_time);

-- Seed 32 half-hour slots from 06:00 to 22:00
-- Uses a generate_series CTE so re-running is safe (ON CONFLICT).
INSERT INTO time_slots (id, label, start_time, end_time, slot_order)
SELECT
  gen_random_uuid(),
  to_char(('06:00'::TIME + (i * INTERVAL '30 minutes')), 'HH24:MI'),
  '06:00'::TIME + (i * INTERVAL '30 minutes'),
  '06:00'::TIME + ((i + 1) * INTERVAL '30 minutes'),
  i + 1
FROM generate_series(0, 31) AS s(i)
ON CONFLICT (start_time) DO NOTHING;

-- ── Court Slot Overrides (per-date status) ──────────────────
-- Overrides the default 'available' status for a specific
-- court + date + time_slot combination.
CREATE TABLE IF NOT EXISTS court_slot_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id      UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  time_slot_id  UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  status        slot_status NOT NULL DEFAULT 'available',
  locked_reason TEXT,
  booking_id    UUID,                    -- FK added after bookings table exists (010)
  locked_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_court_slot_override
  ON court_slot_overrides (court_id, date, time_slot_id);

CREATE INDEX IF NOT EXISTS idx_cso_court_date ON court_slot_overrides (court_id, date);
CREATE INDEX IF NOT EXISTS idx_cso_status     ON court_slot_overrides (status);

DROP TRIGGER IF EXISTS trg_cso_updated_at ON court_slot_overrides;
CREATE TRIGGER trg_cso_updated_at
  BEFORE UPDATE ON court_slot_overrides
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Month Locks ─────────────────────────────────────────────
-- Future months are locked by default.  An admin unlocks a month
-- to make its slots bookable.
CREATE TABLE IF NOT EXISTS month_locks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month  TEXT NOT NULL UNIQUE,      -- format: 'YYYY-MM'
  is_locked   BOOLEAN NOT NULL DEFAULT true,
  unlocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_year_month_format
    CHECK (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX IF NOT EXISTS idx_month_locks_ym ON month_locks (year_month);
