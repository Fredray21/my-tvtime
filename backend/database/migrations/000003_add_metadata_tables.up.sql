CREATE TABLE movie_metadata (
    tmdb_movie_id INTEGER PRIMARY KEY,
    title VARCHAR(255),
    release_date DATE,
    runtime INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE episode_metadata (
    tmdb_series_id INTEGER,
    season_number INTEGER,
    episode_number INTEGER,
    runtime INTEGER DEFAULT 0,
    air_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tmdb_series_id, season_number, episode_number)
);

CREATE INDEX idx_movie_metadata_tmdb_movie_id ON movie_metadata (tmdb_movie_id);
CREATE INDEX idx_episode_metadata_tmdb_series_id ON episode_metadata (tmdb_series_id);
