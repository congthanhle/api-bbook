-- 011_add_deleted_at_to_products.sql
-- Add deleted_at column for soft deletes on products table

ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
