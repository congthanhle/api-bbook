-- ============================================================
-- 008_add_deleted_at_to_customers.sql
-- Fix missing deleted_at column on customers table
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
