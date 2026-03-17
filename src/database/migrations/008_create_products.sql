-- ============================================================
-- 008_create_products.sql
-- Products and services available for sale / attachment to bookings
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    product_category NOT NULL,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),  -- Selling price
  cost_price  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_qty   INTEGER NOT NULL DEFAULT 0,
  sku         TEXT,
  image_url   TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Now add the FK from booking_services → products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_bs_product' AND table_name = 'booking_services'
  ) THEN
    ALTER TABLE booking_services
      ADD CONSTRAINT fk_bs_product
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;
