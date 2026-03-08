-- ============================================================
-- 008_create_app_settings.sql
-- Application settings stored as JSONB for dynamic configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic trigger to auto-update the timestamp
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert default configurations
INSERT INTO app_settings (key, value)
VALUES
    ('venue_info', '{"venueName": "CourtOS Arena", "address": "123 Sports Ave", "phone": "0901234567", "email": "contact@courtos.io", "logoUrl": null}'::jsonb),
    ('operating_hours', '{"weekdayOpen": "06:00", "weekdayClose": "22:00", "weekendOpen": "06:00", "weekendClose": "23:00"}'::jsonb),
    ('booking_rules', '{"minAdvanceHours": 2, "maxAdvanceDays": 30, "cancellationHours": 24, "autoLockFutureMonths": true, "defaultSlotDuration": 60}'::jsonb),
    ('holidays', '[]'::jsonb),
    ('notifications', '{"emailEnabled": true, "smsEnabled": false, "triggers": {"booking_created": true, "booking_cancelled": true, "shift_assigned": true}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
