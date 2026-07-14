package tv

import "time"

type UserSeries struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	TMDBSeriesID int    `json:"tmdb_series_id"`
	Status       string `json:"status"` // 'watchlist', 'watching', 'finished', 'pending'
	IsFavorite   bool   `json:"is_favorite"`

	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

type UserEpisode struct {
	ID            string    `json:"id"`
	TMDBSeriesID  int       `json:"tmdb_series_id"`
	SeasonNumber  int       `json:"season_number"`
	EpisodeNumber int       `json:"episode_number"`
	RewatchCount  int       `json:"rewatch_count"`
	LastWatchedAt time.Time `json:"last_watched_at"`
}

type SeriesRecord struct {
	ID           string
	UserID       string
	TMDBSeriesID int
	Status       string
	IsFavorite   bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type EpisodeRecord struct {
	ID             string
	UserID         string
	TMDBSeriesID   int
	SeasonNumber   int
	EpisodeNumber  int
	RewatchCount   int
	FirstWatchedAt time.Time
	LastWatchedAt  time.Time
}

type SeriesStatus struct {
	Status     string
	IsFavorite bool
}
