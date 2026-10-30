-- Appareils abonnés aux notifications push (un abonnement = un navigateur / téléphone)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Sorties déjà notifiées : évite les doublons (redémarrage de l'API, plusieurs passages dans la journée)
-- detail = "S3E5" pour un épisode, "theatrical" / "digital" pour une sortie de film
CREATE TABLE IF NOT EXISTS push_notifications_sent (
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL,
    tmdb_id INT NOT NULL,
    detail VARCHAR(30) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, media_type, tmdb_id, detail)
);
