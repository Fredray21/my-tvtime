DROP INDEX IF EXISTS idx_user_series_notifications;
ALTER TABLE user_series DROP COLUMN IF EXISTS notifications_enabled;
