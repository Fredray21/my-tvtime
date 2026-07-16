package tv

import (
	"database/sql"
	"errors"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// ==========================================
// 1. GESTION DES SÉRIES (user_series)
// ==========================================

// SaveSeriesStatus : Ajoute ou met à jour le statut global d'une série (Watchlist, Watching, Finished, Pending)
func (r *Repository) SaveSeriesStatus(userID string, tmdbSeriesID int, status string, isFavorite bool, createdAt time.Time, updatedAt time.Time) error {
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	if updatedAt.IsZero() {
		updatedAt = time.Now()
	}

	query := `
		INSERT INTO user_series (user_id, tmdb_series_id, status, is_favorite, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, tmdb_series_id)
		DO UPDATE SET 
			status = EXCLUDED.status,
			is_favorite = EXCLUDED.is_favorite,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.db.Exec(query, userID, tmdbSeriesID, status, isFavorite, createdAt, updatedAt)
	return err
}

// GetSeriesStatus : Récupère le statut d'une série spécifique pour un utilisateur donné
func (r *Repository) GetSeriesStatus(userID string, tmdbSeriesID int) (*SeriesRecord, error) {
	query := `
		SELECT id, user_id, tmdb_series_id, status, is_favorite, created_at, updated_at
		FROM user_series 
		WHERE user_id = $1 AND tmdb_series_id = $2
	`
	var series SeriesRecord
	err := r.db.QueryRow(query, userID, tmdbSeriesID).Scan(
		&series.ID, &series.UserID, &series.TMDBSeriesID,
		&series.Status, &series.IsFavorite, &series.CreatedAt, &series.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &series, nil
}

// GetSeriesOrderByStatusRecords : Récupère toutes les séries ayant un statut spécifique avec pagination
func (r *Repository) GetSeriesOrderByStatusRecords(userID string, page int, limit int) ([]SeriesRecord, error) {
	offset := (page - 1) * limit

	// 1: watching, 2: pending, 3: watchlist, 4: finished
	query := `
        SELECT tmdb_series_id, status, is_favorite, created_at, updated_at
        FROM user_series 
        WHERE user_id = $1 
        ORDER BY 
            CASE status 
                WHEN 'watching' THEN 1 
                WHEN 'pending' THEN 2 
                WHEN 'watchlist' THEN 3 
                WHEN 'finished' THEN 4 
                ELSE 5 
            END ASC,
            updated_at DESC
        LIMIT $2 OFFSET $3
    `

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []SeriesRecord
	for rows.Next() {
		var rec SeriesRecord
		err := rows.Scan(&rec.TMDBSeriesID, &rec.Status, &rec.IsFavorite, &rec.CreatedAt, &rec.UpdatedAt)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// GetFavoriteSeriesRecords : Récupère toutes les séries marquées en favori
func (r *Repository) GetFavoriteSeriesRecords(userID string) ([]SeriesRecord, error) {
	query := `
		SELECT id, user_id, tmdb_series_id, status, is_favorite, created_at, updated_at
		FROM user_series 
		WHERE user_id = $1 AND is_favorite = true
		ORDER BY updated_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []SeriesRecord
	for rows.Next() {
		var s SeriesRecord
		if err := rows.Scan(&s.ID, &s.UserID, &s.TMDBSeriesID, &s.Status, &s.IsFavorite, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, s)
	}
	return records, nil
}

// DeleteSeries : Supprime complètement une série du suivi de l'utilisateur
func (r *Repository) DeleteSeries(userID string, tmdbSeriesID int) error {
	query := `DELETE FROM user_series WHERE user_id = $1 AND tmdb_series_id = $2`
	result, err := r.db.Exec(query, userID, tmdbSeriesID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("series not found in user list")
	}

	return nil
}

// GetUserStatusesForSeries : Récupération en masse des statuts (pour les listes de recherche)
func (r *Repository) GetUserStatusesForSeries(userID string, tmdbIDs []int) (map[int]SeriesStatus, error) {
	if len(tmdbIDs) == 0 {
		return make(map[int]SeriesStatus), nil
	}

	query := `
		SELECT tmdb_series_id, status, is_favorite 
		FROM user_series 
		WHERE user_id = $1 AND tmdb_series_id = ANY($2)
	`

	rows, err := r.db.Query(query, userID, tmdbIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make(map[int]SeriesStatus)
	for rows.Next() {
		var tmdbID int
		var ms SeriesStatus
		err := rows.Scan(&tmdbID, &ms.Status, &ms.IsFavorite)
		if err != nil {
			return nil, err
		}
		results[tmdbID] = ms
	}

	return results, nil
}

// ==========================================
// 2. GESTION DES ÉPISODES (user_episodes)
// ==========================================

// SaveEpisode : Marque un épisode comme vu. S'il existe déjà, incrémente le rewatch_count.
func (r *Repository) SaveEpisode(userID string, tmdbSeriesID int, seasonNumber int, episodeNumber int, watchedAt time.Time) error {
	query := `
		INSERT INTO user_episodes (user_id, tmdb_series_id, season_number, episode_number, rewatch_count, first_watched_at, last_watched_at)
		VALUES ($1, $2, $3, $4, 0, $5, $5)
		ON CONFLICT (user_id, tmdb_series_id, season_number, episode_number)
		DO UPDATE SET 
			rewatch_count = user_episodes.rewatch_count + 1,
			last_watched_at = EXCLUDED.last_watched_at;
	`
	_, err := r.db.Exec(query, userID, tmdbSeriesID, seasonNumber, episodeNumber, watchedAt)
	return err
}

// GetWatchedEpisodesForSeries : Récupère tous les épisodes vus d'une série pour calculer l'avancement
func (r *Repository) GetWatchedEpisodesForSeries(userID string, tmdbSeriesID int) ([]EpisodeRecord, error) {
	query := `
		SELECT id, season_number, episode_number, rewatch_count, first_watched_at, last_watched_at 
		FROM user_episodes 
		WHERE user_id = $1 AND tmdb_series_id = $2
		ORDER BY season_number ASC, episode_number ASC
	`

	rows, err := r.db.Query(query, userID, tmdbSeriesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var episodes []EpisodeRecord
	for rows.Next() {
		var ep EpisodeRecord
		ep.UserID = userID
		ep.TMDBSeriesID = tmdbSeriesID

		err := rows.Scan(
			&ep.ID, &ep.SeasonNumber, &ep.EpisodeNumber,
			&ep.RewatchCount, &ep.FirstWatchedAt, &ep.LastWatchedAt,
		)
		if err != nil {
			return nil, err
		}
		episodes = append(episodes, ep)
	}
	return episodes, nil
}

// DeleteEpisode : Retire un épisode de la liste des vus (utile si l'utilisateur s'est trompé)
func (r *Repository) DeleteEpisode(userID string, tmdbSeriesID int, seasonNumber int, episodeNumber int) error {
	query := `
		DELETE FROM user_episodes 
		WHERE user_id = $1 AND tmdb_series_id = $2 AND season_number = $3 AND episode_number = $4
	`
	result, err := r.db.Exec(query, userID, tmdbSeriesID, seasonNumber, episodeNumber)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("episode not found in watched list")
	}

	return nil
}

// Décrémente le rewatch_count d'un épisode d'exactement 1 (sans descendre sous 0)
func (r *Repository) DecrementEpisodeRewatch(userID string, tmdbSeriesID, seasonNum, episodeNum int) error {
	query := `
		UPDATE user_episodes 
		SET rewatch_count = GREATEST(0, rewatch_count - 1),
			last_watched_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND tmdb_series_id = $2 AND season_number = $3 AND episode_number = $4
	`
	_, err := r.db.Exec(query, userID, tmdbSeriesID, seasonNum, episodeNum)
	return err
}

// GetWatchedCountBySeason renvoie un dictionnaire [numero_saison] => nombre_episodes_vus
func (r *Repository) GetWatchedCountBySeason(userID string, seriesID int) (map[int]int, error) {
	query := `
        SELECT season_number, COUNT(*) as watched_count
        FROM user_episodes 
        WHERE user_id = $1 AND tmdb_series_id = $2
        GROUP BY season_number
    `
    rows, err := r.db.Query(query, userID, seriesID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    counts := make(map[int]int)
    for rows.Next() {
        var seasonNum, count int
        if err := rows.Scan(&seasonNum, &count); err == nil {
            counts[seasonNum] = count
        }
    }
    return counts, nil
}

// Récupère les épisodes les plus récents vus (pour le "Latest")
func (r *Repository) GetLatestWatchedEpisodes(userID string, limit, offset int) ([]EpisodeRecord, error) {
	query := `
        SELECT tmdb_series_id, season_number, episode_number, rewatch_count 
        FROM (
            SELECT DISTINCT ON (tmdb_series_id) 
                tmdb_series_id, season_number, episode_number, rewatch_count, last_watched_at
            FROM user_episodes 
            WHERE user_id = $1 
            ORDER BY tmdb_series_id, last_watched_at DESC
        ) AS latest_episodes
        ORDER BY last_watched_at DESC
        LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []EpisodeRecord
	for rows.Next() {
		var rec EpisodeRecord
		if err := rows.Scan(&rec.TMDBSeriesID, &rec.SeasonNumber, &rec.EpisodeNumber, &rec.RewatchCount); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

func (r *Repository) GetTVStatsCalculated(userID string) (int, int, error) {
	query := `
		SELECT COALESCE(SUM(1 + ue.rewatch_count), 0), 
		       COALESCE(SUM(em.runtime * (1 + ue.rewatch_count)), 0)
		FROM user_episodes ue
		LEFT JOIN episode_metadata em 
			ON ue.tmdb_series_id = em.tmdb_series_id 
			AND ue.season_number = em.season_number 
			AND ue.episode_number = em.episode_number
		WHERE ue.user_id = $1`

	var totalEpisodes, totalMinutes int
	err := r.db.QueryRow(query, userID).Scan(&totalEpisodes, &totalMinutes)
	return totalEpisodes, totalMinutes, err
}

func (r *Repository) GetUpcomingSeriesRecords(userID string, page int, limit int) ([]SeriesUpcomingRecord, error) {
	offset := (page - 1) * limit

	query := `
		SELECT us.tmdb_series_id, us.status, us.is_favorite, em.air_date, 
			array_agg(em.episode_number) as episodes, 
			array_agg(em.season_number) as seasons,
			us.created_at, us.updated_at
		FROM user_series us
		JOIN episode_metadata em ON us.tmdb_series_id = em.tmdb_series_id
		WHERE us.user_id = $1 
		AND em.air_date > CURRENT_DATE
		GROUP BY us.tmdb_series_id, us.status, us.is_favorite, em.air_date, us.created_at, us.updated_at
		ORDER BY em.air_date ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []SeriesUpcomingRecord
	for rows.Next() {
		var rec SeriesUpcomingRecord
		err := rows.Scan(
			&rec.TMDBSeriesID,
			&rec.Status,
			&rec.IsFavorite,
			&rec.AirDate,
			&rec.Episodes,
			&rec.Seasons,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

func (r *Repository) SaveEpisodeMetadata(seriesID int, seasonNum int, episodeNum int, runtime int, airDate string) error {
	query := `
		INSERT INTO episode_metadata (tmdb_series_id, season_number, episode_number, runtime, air_date, updated_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, '')::DATE, CURRENT_TIMESTAMP)
		ON CONFLICT (tmdb_series_id, season_number, episode_number) DO UPDATE SET
			runtime = EXCLUDED.runtime,
			air_date = EXCLUDED.air_date,
			updated_at = CURRENT_TIMESTAMP;
	`
	_, err := r.db.Exec(query, seriesID, seasonNum, episodeNum, runtime, airDate)
	return err
}
