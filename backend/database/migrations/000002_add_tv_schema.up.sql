-- Suivi global de la série (Watchlist, Favoris)
CREATE TABLE IF NOT EXISTS user_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_series_id INT NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'watchlist', 'watching', 'finished', 'pending'
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_series UNIQUE (user_id, tmdb_series_id)
);

-- Suivi précis des épisodes vus
CREATE TABLE IF NOT EXISTS user_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_series_id INT NOT NULL,
    season_number INT NOT NULL,
    episode_number INT NOT NULL,
    rewatch_count INT DEFAULT 0,
    first_watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_episode UNIQUE (user_id, tmdb_series_id, season_number, episode_number),

    CONSTRAINT fk_user_series 
        FOREIGN KEY (user_id, tmdb_series_id) 
        REFERENCES user_series(user_id, tmdb_series_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_series_user_id ON user_series(user_id);
CREATE INDEX IF NOT EXISTS idx_user_episodes_user_id ON user_episodes(user_id, tmdb_series_id);