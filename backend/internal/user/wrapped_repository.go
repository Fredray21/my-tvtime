package user

import "time"

type WrappedMovieRecord struct {
	TMDBMovieID  int
	IsFavorite   bool
	RewatchCount int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type WrappedEpisodeRecord struct {
	TMDBSeriesID   int
	SeasonNumber   int
	EpisodeNumber  int
	FirstWatchedAt time.Time
	Runtime        int
}

// GetWrappedYears liste les années où l'utilisateur a eu de l'activité (heure de Paris)
func (r *Repository) GetWrappedYears(userID string) ([]int, error) {
	query := `
		SELECT DISTINCT y FROM (
			SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Europe/Paris')::INT AS y
			FROM user_movies WHERE user_id = $1 AND status = 'watched'
			UNION
			SELECT EXTRACT(YEAR FROM first_watched_at AT TIME ZONE 'Europe/Paris')::INT AS y
			FROM user_episodes WHERE user_id = $1
		) years
		ORDER BY y DESC`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	years := make([]int, 0)
	for rows.Next() {
		var y int
		if err := rows.Scan(&y); err != nil {
			return nil, err
		}
		years = append(years, y)
	}
	return years, nil
}

// GetWrappedMovies : films vus pour la 1ère fois OU revus sur la période
func (r *Repository) GetWrappedMovies(userID string, start, end time.Time) ([]WrappedMovieRecord, error) {
	query := `
		SELECT tmdb_movie_id, is_favorite, rewatch_count, created_at, updated_at
		FROM user_movies
		WHERE user_id = $1 AND status = 'watched'
		  AND ((created_at >= $2 AND created_at < $3)
		    OR (rewatch_count > 0 AND updated_at >= $2 AND updated_at < $3))
		ORDER BY created_at`

	rows, err := r.db.Query(query, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []WrappedMovieRecord
	for rows.Next() {
		var rec WrappedMovieRecord
		if err := rows.Scan(&rec.TMDBMovieID, &rec.IsFavorite, &rec.RewatchCount, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// GetWrappedEpisodes : épisodes vus pour la 1ère fois sur la période, avec leur durée connue
func (r *Repository) GetWrappedEpisodes(userID string, start, end time.Time) ([]WrappedEpisodeRecord, error) {
	query := `
		SELECT ue.tmdb_series_id, ue.season_number, ue.episode_number, ue.first_watched_at, COALESCE(em.runtime, 0)
		FROM user_episodes ue
		LEFT JOIN episode_metadata em
			ON ue.tmdb_series_id = em.tmdb_series_id
			AND ue.season_number = em.season_number
			AND ue.episode_number = em.episode_number
		WHERE ue.user_id = $1 AND ue.first_watched_at >= $2 AND ue.first_watched_at < $3
		ORDER BY ue.first_watched_at`

	rows, err := r.db.Query(query, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []WrappedEpisodeRecord
	for rows.Next() {
		var rec WrappedEpisodeRecord
		if err := rows.Scan(&rec.TMDBSeriesID, &rec.SeasonNumber, &rec.EpisodeNumber, &rec.FirstWatchedAt, &rec.Runtime); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// CountNewSeries : séries dont le tout premier épisode vu tombe sur la période
func (r *Repository) CountNewSeries(userID string, start, end time.Time) (int, error) {
	query := `
		SELECT COUNT(*) FROM (
			SELECT tmdb_series_id FROM user_episodes
			WHERE user_id = $1
			GROUP BY tmdb_series_id
			HAVING MIN(first_watched_at) >= $2 AND MIN(first_watched_at) < $3
		) new_series`

	var count int
	err := r.db.QueryRow(query, userID, start, end).Scan(&count)
	return count, err
}
