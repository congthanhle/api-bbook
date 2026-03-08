-- ============================================================
-- 006_create_shifts.sql
-- Shift scheduling and staff assignment
-- ============================================================

-- ── Shifts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  notes       TEXT,
  status      shift_status NOT NULL DEFAULT 'upcoming',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_shifts_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_shifts_date   ON shifts (date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Shift Assignments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  notes           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_assignment
  ON shift_assignments (shift_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_sa_shift ON shift_assignments (shift_id);
CREATE INDEX IF NOT EXISTS idx_sa_staff ON shift_assignments (staff_id);
