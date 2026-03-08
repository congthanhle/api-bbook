-- ============================================================
-- 002_create_courts.sql
-- Courts and price rules with exclusion constraint
-- ============================================================

-- ── Courts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        court_type NOT NULL,
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courts_type      ON courts (type);
CREATE INDEX IF NOT EXISTS idx_courts_is_active ON courts (is_active);

DROP TRIGGER IF EXISTS trg_courts_updated_at ON courts;
CREATE TRIGGER trg_courts_updated_at
  BEFORE UPDATE ON courts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── Price Rules ─────────────────────────────────────────────
-- Each rule defines a price for a court during a time window on a
-- given day_type.  When day_type = 'specific_date', the specific_date
-- column overrides the day_type lookup.
-- Price is stored in VND (smallest unit, i.e. integer dong).
CREATE TABLE IF NOT EXISTS price_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id      UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_type      day_type NOT NULL,
  specific_date DATE,                    -- only used when day_type = 'specific_date'
  time_start    TIME NOT NULL,
  time_end      TIME NOT NULL,
  price         INTEGER NOT NULL CHECK (price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent overlapping time ranges for the same court + day_type.
  -- Uses btree_gist extension for the exclusion constraint on tsrange.
  CONSTRAINT no_overlap_price_rules
    EXCLUDE USING gist (
      court_id WITH =,
      day_type WITH =,
      tsrange(
        ('2000-01-01'::DATE + time_start)::TIMESTAMP,
        ('2000-01-01'::DATE + time_end)::TIMESTAMP
      ) WITH &&
    )
    WHERE (specific_date IS NULL),

  CONSTRAINT chk_price_rules_time_order CHECK (time_start < time_end)
);

CREATE INDEX IF NOT EXISTS idx_price_rules_court    ON price_rules (court_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_day_type ON price_rules (day_type);

DROP TRIGGER IF EXISTS trg_price_rules_updated_at ON price_rules;
CREATE TRIGGER trg_price_rules_updated_at
  BEFORE UPDATE ON price_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
