CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY, -- Clerk
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS user_movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_movie_id INT NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'watchlist' or 'watched'
    is_favorite BOOLEAN DEFAULT FALSE,
    rewatch_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_movie UNIQUE (user_id, tmdb_movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_movies_user_id ON user_movies(user_id);



-- CREATE TABLE IF NOT EXISTS tmdb_cache (
--     cache_key TEXT PRIMARY KEY,
--     data JSONB NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     expires_at TIMESTAMP
-- );

-- CREATE INDEX IF NOT EXISTS idx_tmdb_cache_key ON tmdb_cache(cache_key);
-- CREATE INDEX IF NOT EXISTS idx_tmdb_cache_expires ON tmdb_cache(expires_at);
