-- ============================================================
-- 009_rls_policies.sql
-- Row Level Security policies for ALL tables
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- Helper: check if the current JWT role is 'admin'
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════
-- users
-- ════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own"   ON users;
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_manage_admin" ON users;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  USING (is_admin());

CREATE POLICY "users_manage_admin"
  ON users FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- courts
-- ════════════════════════════════════════════════════════════
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courts_select_authenticated" ON courts;
DROP POLICY IF EXISTS "courts_manage_admin"         ON courts;

CREATE POLICY "courts_select_authenticated"
  ON courts FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "courts_manage_admin"
  ON courts FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- price_rules
-- ════════════════════════════════════════════════════════════
ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_rules_select_authenticated" ON price_rules;
DROP POLICY IF EXISTS "price_rules_manage_admin"         ON price_rules;

CREATE POLICY "price_rules_select_authenticated"
  ON price_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "price_rules_manage_admin"
  ON price_rules FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- time_slots (public read, admin write)
-- ════════════════════════════════════════════════════════════
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_slots_select_authenticated" ON time_slots;
DROP POLICY IF EXISTS "time_slots_manage_admin"         ON time_slots;

CREATE POLICY "time_slots_select_authenticated"
  ON time_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "time_slots_manage_admin"
  ON time_slots FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- court_slot_overrides
-- ════════════════════════════════════════════════════════════
ALTER TABLE court_slot_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cso_select_authenticated" ON court_slot_overrides;
DROP POLICY IF EXISTS "cso_manage_admin"         ON court_slot_overrides;

CREATE POLICY "cso_select_authenticated"
  ON court_slot_overrides FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "cso_manage_admin"
  ON court_slot_overrides FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- month_locks
-- ════════════════════════════════════════════════════════════
ALTER TABLE month_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "month_locks_select_authenticated" ON month_locks;
DROP POLICY IF EXISTS "month_locks_manage_admin"         ON month_locks;

CREATE POLICY "month_locks_select_authenticated"
  ON month_locks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "month_locks_manage_admin"
  ON month_locks FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- bookings
-- ════════════════════════════════════════════════════════════
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_staff" ON bookings;
DROP POLICY IF EXISTS "bookings_manage_admin" ON bookings;

-- Admin + staff can read all bookings
CREATE POLICY "bookings_select_staff"
  ON bookings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can do all; staff can insert + update (not delete)
CREATE POLICY "bookings_manage_admin"
  ON bookings FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "bookings_insert_staff" ON bookings;
CREATE POLICY "bookings_insert_staff"
  ON bookings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "bookings_update_staff" ON bookings;
CREATE POLICY "bookings_update_staff"
  ON bookings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- booking_services
-- ════════════════════════════════════════════════════════════
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bs_select_authenticated" ON booking_services;
DROP POLICY IF EXISTS "bs_manage_admin"         ON booking_services;
DROP POLICY IF EXISTS "bs_insert_staff"         ON booking_services;

CREATE POLICY "bs_select_authenticated"
  ON booking_services FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "bs_manage_admin"
  ON booking_services FOR ALL
  USING (is_admin());

CREATE POLICY "bs_insert_staff"
  ON booking_services FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- staff_profiles
-- ════════════════════════════════════════════════════════════
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_profiles_select_own"   ON staff_profiles;
DROP POLICY IF EXISTS "staff_profiles_manage_admin"  ON staff_profiles;

-- Staff can read their own profile
CREATE POLICY "staff_profiles_select_own"
  ON staff_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admin can read and manage all
CREATE POLICY "staff_profiles_manage_admin"
  ON staff_profiles FOR ALL
  USING (is_admin());

-- ════════════════════════════════════════════════════════════
-- shifts
-- ════════════════════════════════════════════════════════════
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_manage_admin"   ON shifts;
DROP POLICY IF EXISTS "shifts_select_assigned" ON shifts;

-- Admin can do everything
CREATE POLICY "shifts_manage_admin"
  ON shifts FOR ALL
  USING (is_admin());

-- Staff can read shifts they are assigned to
CREATE POLICY "shifts_select_assigned"
  ON shifts FOR SELECT
  USING (
    id IN (
      SELECT shift_id FROM shift_assignments WHERE staff_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════
-- shift_assignments
-- ════════════════════════════════════════════════════════════
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_manage_admin"   ON shift_assignments;
DROP POLICY IF EXISTS "sa_select_own"     ON shift_assignments;
DROP POLICY IF EXISTS "sa_update_own"     ON shift_assignments;

CREATE POLICY "sa_manage_admin"
  ON shift_assignments FOR ALL
  USING (is_admin());

-- Staff can see their own assignments
CREATE POLICY "sa_select_own"
  ON shift_assignments FOR SELECT
  USING (staff_id = auth.uid());

-- Staff can update their own check-in/out
CREATE POLICY "sa_update_own"
  ON shift_assignments FOR UPDATE
  USING (staff_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- customers
-- ════════════════════════════════════════════════════════════
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_staff" ON customers;
DROP POLICY IF EXISTS "customers_manage_staff" ON customers;

-- Admin + staff can read & write customers
CREATE POLICY "customers_select_staff"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_manage_staff"
  ON customers FOR ALL
  USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- products
-- ════════════════════════════════════════════════════════════
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_staff" ON products;
DROP POLICY IF EXISTS "products_manage_admin" ON products;

-- Staff can read active products
CREATE POLICY "products_select_staff"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can manage products
CREATE POLICY "products_manage_admin"
  ON products FOR ALL
  USING (is_admin());
