package tv

import (
	"time"

	"github.com/lib/pq"
)

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

type SeriesIdentifier interface {
	GetTMDBID() int
	GetStatus() string
	GetIsFavorite() bool
	GetCreatedAt() time.Time
	GetUpdatedAt() time.Time
}

func (r SeriesRecord) GetTMDBID() int          { return r.TMDBSeriesID }
func (r SeriesRecord) GetStatus() string       { return r.Status }
func (r SeriesRecord) GetIsFavorite() bool     { return r.IsFavorite }
func (r SeriesRecord) GetCreatedAt() time.Time { return r.CreatedAt }
func (r SeriesRecord) GetUpdatedAt() time.Time { return r.UpdatedAt }

func (r SeriesUpcomingRecord) GetTMDBID() int          { return r.TMDBSeriesID }
func (r SeriesUpcomingRecord) GetStatus() string       { return r.Status }
func (r SeriesUpcomingRecord) GetIsFavorite() bool     { return r.IsFavorite }
func (r SeriesUpcomingRecord) GetCreatedAt() time.Time { return r.CreatedAt }
func (r SeriesUpcomingRecord) GetUpdatedAt() time.Time { return r.UpdatedAt }

type SeriesRecord struct {
	ID           string
	UserID       string
	TMDBSeriesID int
	Status       string
	IsFavorite   bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type SeriesUpcomingRecord struct {
	TMDBSeriesID int
	Status       string
	IsFavorite   bool
	CreatedAt    time.Time
	UpdatedAt    time.Time

	AirDate  time.Time
	Episodes pq.Int64Array
	Seasons  pq.Int64Array
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
