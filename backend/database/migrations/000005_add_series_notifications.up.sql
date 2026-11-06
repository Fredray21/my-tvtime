-- Notifications des nouveaux épisodes, activées série par série (désactivées par défaut)
ALTER TABLE user_series ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_series_notifications ON user_series(user_id) WHERE notifications_enabled;
