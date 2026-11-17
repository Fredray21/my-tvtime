-- Note personnelle (1 à 10, affichée en demi-étoiles sur 5)
ALTER TABLE user_movies ADD COLUMN IF NOT EXISTS user_rating SMALLINT CHECK (user_rating BETWEEN 1 AND 10);
ALTER TABLE user_series ADD COLUMN IF NOT EXISTS user_rating SMALLINT CHECK (user_rating BETWEEN 1 AND 10);

-- Plateformes de streaming auxquelles l'utilisateur est abonné (identifiants TMDB / JustWatch)
CREATE TABLE IF NOT EXISTS user_providers (
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider_id)
);
