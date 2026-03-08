-- ============================================================
-- 010_functions_and_triggers.sql
-- Business-logic functions and triggers
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. handle_new_user()
--    TRIGGER: when a row is inserted into auth.users, auto-create
--    a corresponding row in public.users.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::user_role,
      'staff'::user_role
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop + recreate so it is idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 2. generate_booking_code(p_date DATE)
--    FUNCTION: returns 'BK-YYYYMMDD-XXXX' where XXXX is a
--    zero-padded 4-digit daily sequence number.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generate_booking_code(p_date DATE)
RETURNS TEXT AS $$
DECLARE
  v_date_str TEXT;
  v_count    INTEGER;
  v_code     TEXT;
BEGIN
  v_date_str := to_char(p_date, 'YYYYMMDD');

  -- Count existing bookings for this date to determine next sequence
  SELECT COUNT(*) + 1
  INTO v_count
  FROM bookings
  WHERE date = p_date;

  v_code := 'BK-' || v_date_str || '-' || lpad(v_count::TEXT, 4, '0');

  -- Ensure uniqueness (in case of concurrent inserts)
  WHILE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v_code) LOOP
    v_count := v_count + 1;
    v_code := 'BK-' || v_date_str || '-' || lpad(v_count::TEXT, 4, '0');
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Auto-set booking_code on INSERT if not provided
CREATE OR REPLACE FUNCTION set_booking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    NEW.booking_code := generate_booking_code(NEW.date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_booking_code ON bookings;
CREATE TRIGGER trg_set_booking_code
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_code();

-- ════════════════════════════════════════════════════════════
-- 3. update_customer_stats()
--    TRIGGER: when a booking status transitions to 'completed',
--    increment the customer's total_visits and total_spend,
--    and update last_visit_at.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE customers
    SET
      total_visits  = total_visits + 1,
      total_spend   = total_spend + NEW.total_amount,
      last_visit_at = NEW.date
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_stats ON bookings;
CREATE TRIGGER trg_update_customer_stats
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- ════════════════════════════════════════════════════════════
-- 4. auto_lock_future_months()
--    FUNCTION: Inserts month_locks rows for the next 12 months
--    (from the current month). Skips months that already exist.
--    Can be called from app startup or a pg_cron job.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_lock_future_months()
RETURNS VOID AS $$
DECLARE
  v_month TEXT;
BEGIN
  FOR i IN 0..11 LOOP
    v_month := to_char(CURRENT_DATE + (i || ' months')::INTERVAL, 'YYYY-MM');

    INSERT INTO month_locks (year_month, is_locked)
    VALUES (v_month, true)
    ON CONFLICT (year_month) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run immediately to seed the next 12 months
SELECT auto_lock_future_months();

-- ════════════════════════════════════════════════════════════
-- 5. get_court_overview(p_date DATE)
--    FUNCTION: returns a JSON array of all active courts, each
--    containing an array of all 32 time slots with their
--    computed status for the given date.
--
--    Slot status resolution order:
--      1. court_slot_overrides row exists → use its status
--      2. month_locks.is_locked = true   → 'locked'
--      3. else                           → 'available'
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_court_overview(p_date DATE)
RETURNS JSONB AS $$
DECLARE
  v_year_month TEXT := to_char(p_date, 'YYYY-MM');
  v_is_locked  BOOLEAN;
BEGIN
  -- Check if the month is locked
  SELECT ml.is_locked INTO v_is_locked
  FROM month_locks ml
  WHERE ml.year_month = v_year_month;

  -- If no month_locks row, treat as locked
  IF v_is_locked IS NULL THEN
    v_is_locked := true;
  END IF;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'court_id',   c.id,
        'court_name', c.name,
        'court_type', c.type,
        'slots', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'slot_id',    ts.id,
              'label',      ts.label,
              'start_time', ts.start_time::TEXT,
              'end_time',   ts.end_time::TEXT,
              'status',     COALESCE(
                              cso.status::TEXT,
                              CASE WHEN v_is_locked THEN 'locked' ELSE 'available' END
                            ),
              'booking_id',    cso.booking_id,
              'locked_reason', cso.locked_reason
            )
            ORDER BY ts.slot_order
          )
          FROM time_slots ts
          LEFT JOIN court_slot_overrides cso
            ON  cso.court_id     = c.id
            AND cso.date         = p_date
            AND cso.time_slot_id = ts.id
        )
      )
      ORDER BY c.name
    )
    FROM courts c
    WHERE c.is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ════════════════════════════════════════════════════════════
-- 6. calculate_booking_price(p_court_id, p_date, p_start, p_end)
--    FUNCTION: calculates the total price for a booking by
--    iterating over each 30-min slot in the range and looking
--    up the applicable price_rule.
--
--    Priority: specific_date rules > day_type rules.
--    If no rule matches a slot, price = 0 (or could raise).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_court_id UUID,
  p_date     DATE,
  p_start    TIME,
  p_end      TIME
)
RETURNS INTEGER AS $$
DECLARE
  v_total      INTEGER := 0;
  v_slot_start TIME;
  v_slot_end   TIME;
  v_slot_price INTEGER;
  v_day        day_type;
  v_dow        INTEGER;
BEGIN
  -- Determine day_type from the date
  v_dow := EXTRACT(ISODOW FROM p_date)::INTEGER;  -- 1=Mon, 7=Sun
  IF v_dow IN (6, 7) THEN
    v_day := 'weekend'::day_type;
  ELSE
    v_day := 'weekday'::day_type;
  END IF;

  -- Iterate in 30-min increments through the booking window
  v_slot_start := p_start;
  WHILE v_slot_start < p_end LOOP
    v_slot_end := v_slot_start + INTERVAL '30 minutes';

    -- Try specific_date rule first, then day_type rule
    SELECT pr.price INTO v_slot_price
    FROM price_rules pr
    WHERE pr.court_id = p_court_id
      AND pr.day_type = 'specific_date'
      AND pr.specific_date = p_date
      AND pr.time_start <= v_slot_start
      AND pr.time_end   >= v_slot_end
    LIMIT 1;

    IF v_slot_price IS NULL THEN
      SELECT pr.price INTO v_slot_price
      FROM price_rules pr
      WHERE pr.court_id = p_court_id
        AND pr.day_type = v_day
        AND pr.time_start <= v_slot_start
        AND pr.time_end   >= v_slot_end
      LIMIT 1;
    END IF;

    -- Each price_rule.price is the price per HOUR, so for a
    -- 30-min slot we take half.  Adjust logic if price = per slot.
    v_total := v_total + COALESCE(v_slot_price, 0) / 2;

    v_slot_start := v_slot_end;
  END LOOP;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;
