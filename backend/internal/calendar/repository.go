package calendar

import (
	"database/sql"

	"github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetFollowedSeries : séries commencées (en cours, à jour ou terminées, une nouvelle saison peut arriver)
func (r *Repository) GetFollowedSeries(userID string) (map[int]string, error) {
	query := `SELECT tmdb_series_id, status FROM user_series WHERE user_id = $1 AND status <> 'watchlist'`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	series := make(map[int]string)
	for rows.Next() {
		var id int
		var status string
		if err := rows.Scan(&id, &status); err != nil {
			return nil, err
		}
		series[id] = status
	}
	return series, nil
}

// GetWatchlistMovies : films en attente de visionnage
func (r *Repository) GetWatchlistMovies(userID string) ([]int, error) {
	query := `SELECT tmdb_movie_id FROM user_movies WHERE user_id = $1 AND status = 'watchlist'`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int, 0)
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

type episodeKey struct {
	SeriesID int
	Season   int
	Episode  int
}

// GetWatchedEpisodes renvoie l'ensemble des épisodes déjà vus pour une liste de séries
func (r *Repository) GetWatchedEpisodes(userID string, seriesIDs []int) (map[episodeKey]bool, error) {
	watched := make(map[episodeKey]bool)
	if len(seriesIDs) == 0 {
		return watched, nil
	}

	query := `
		SELECT tmdb_series_id, season_number, episode_number
		FROM user_episodes
		WHERE user_id = $1 AND tmdb_series_id = ANY($2)`

	rows, err := r.db.Query(query, userID, pq.Array(seriesIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var key episodeKey
		if err := rows.Scan(&key.SeriesID, &key.Season, &key.Episode); err != nil {
			return nil, err
		}
		watched[key] = true
	}
	return watched, nil
}
