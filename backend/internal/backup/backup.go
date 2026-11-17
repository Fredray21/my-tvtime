// Package backup : export de toutes les données d'un utilisateur dans un fichier JSON,
// et import de ce même fichier (restauration ou transfert vers un autre compte / une autre instance).
package backup

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

const (
	Format  = "my-tvtime"
	Version = 1
)

// File : contenu du fichier de sauvegarde. Les notes sont sur 10 (affichées en demi-étoiles sur 5).
type File struct {
	Format     string    `json:"format"`
	Version    int       `json:"version"`
	ExportedAt time.Time `json:"exported_at"`
	Movies     []Movie   `json:"movies"`
	Series     []Series  `json:"series"`
	Platforms  []int     `json:"platforms"`
}

type Movie struct {
	TMDBID       int       `json:"tmdb_id"`
	Status       string    `json:"status"` // watchlist | watched
	IsFavorite   bool      `json:"is_favorite"`
	RewatchCount int       `json:"rewatch_count"`
	Rating       *int      `json:"rating"`
	AddedAt      time.Time `json:"added_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Series struct {
	TMDBID        int       `json:"tmdb_id"`
	Status        string    `json:"status"` // watchlist | watching | pending | finished
	IsFavorite    bool      `json:"is_favorite"`
	Rating        *int      `json:"rating"`
	Notifications bool      `json:"notifications"`
	AddedAt       time.Time `json:"added_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Episodes      []Episode `json:"episodes"`
}

type Episode struct {
	Season         int       `json:"season"`
	Episode        int       `json:"episode"`
	RewatchCount   int       `json:"rewatch_count"`
	FirstWatchedAt time.Time `json:"first_watched_at"`
	LastWatchedAt  time.Time `json:"last_watched_at"`
}

// ImportResult : ce qui a été importé
type ImportResult struct {
	Movies    int `json:"movies"`
	Series    int `json:"series"`
	Episodes  int `json:"episodes"`
	Platforms int `json:"platforms"`
}

var (
	movieStatuses  = map[string]bool{"watchlist": true, "watched": true}
	seriesStatuses = map[string]bool{"watchlist": true, "watching": true, "pending": true, "finished": true}
)

type Service struct {
	db   *sql.DB
	tmdb *tmdb.Client
}

func NewService(db *sql.DB, tmdbClient *tmdb.Client) *Service {
	return &Service{db: db, tmdb: tmdbClient}
}

// Export : toutes les données de l'utilisateur
func (s *Service) Export(userID string) (*File, error) {
	file := &File{Format: Format, Version: Version, ExportedAt: time.Now().UTC(), Movies: []Movie{}, Series: []Series{}, Platforms: []int{}}

	rows, err := s.db.Query(`
		SELECT tmdb_movie_id, status, COALESCE(is_favorite, FALSE), COALESCE(rewatch_count, 0), user_rating, created_at, updated_at
		FROM user_movies WHERE user_id = $1 ORDER BY created_at, tmdb_movie_id`, userID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var m Movie
		var rating sql.NullInt64
		if err := rows.Scan(&m.TMDBID, &m.Status, &m.IsFavorite, &m.RewatchCount, &rating, &m.AddedAt, &m.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		m.Rating = intPtr(rating)
		file.Movies = append(file.Movies, m)
	}
	rows.Close()

	rows, err = s.db.Query(`
		SELECT tmdb_series_id, status, COALESCE(is_favorite, FALSE), user_rating, notifications_enabled, created_at, updated_at
		FROM user_series WHERE user_id = $1 ORDER BY created_at, tmdb_series_id`, userID)
	if err != nil {
		return nil, err
	}
	index := make(map[int]int)
	for rows.Next() {
		var sr Series
		var rating sql.NullInt64
		if err := rows.Scan(&sr.TMDBID, &sr.Status, &sr.IsFavorite, &rating, &sr.Notifications, &sr.AddedAt, &sr.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		sr.Rating = intPtr(rating)
		sr.Episodes = []Episode{}
		index[sr.TMDBID] = len(file.Series)
		file.Series = append(file.Series, sr)
	}
	rows.Close()

	rows, err = s.db.Query(`
		SELECT tmdb_series_id, season_number, episode_number, COALESCE(rewatch_count, 0), first_watched_at, last_watched_at
		FROM user_episodes WHERE user_id = $1 ORDER BY tmdb_series_id, season_number, episode_number`, userID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var seriesID int
		var ep Episode
		if err := rows.Scan(&seriesID, &ep.Season, &ep.Episode, &ep.RewatchCount, &ep.FirstWatchedAt, &ep.LastWatchedAt); err != nil {
			rows.Close()
			return nil, err
		}
		if i, ok := index[seriesID]; ok {
			file.Series[i].Episodes = append(file.Series[i].Episodes, ep)
		}
	}
	rows.Close()

	rows, err = s.db.Query(`SELECT provider_id FROM user_providers WHERE user_id = $1 ORDER BY provider_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		file.Platforms = append(file.Platforms, id)
	}
	return file, rows.Err()
}

// Parse lit et valide un fichier de sauvegarde
func Parse(data []byte) (*File, error) {
	var file File
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, errors.New("fichier illisible : ce n'est pas une sauvegarde My TvTime")
	}
	if file.Format != Format {
		return nil, errors.New("ce fichier n'est pas une sauvegarde My TvTime")
	}
	if file.Version < 1 || file.Version > Version {
		return nil, fmt.Errorf("version de sauvegarde non prise en charge (%d)", file.Version)
	}
	validRating := func(r *int) bool { return r == nil || (*r >= 1 && *r <= 10) }
	for _, m := range file.Movies {
		if m.TMDBID <= 0 || !movieStatuses[m.Status] || !validRating(m.Rating) || m.RewatchCount < 0 {
			return nil, fmt.Errorf("film invalide dans la sauvegarde (id %d)", m.TMDBID)
		}
	}
	for _, sr := range file.Series {
		if sr.TMDBID <= 0 || !seriesStatuses[sr.Status] || !validRating(sr.Rating) {
			return nil, fmt.Errorf("série invalide dans la sauvegarde (id %d)", sr.TMDBID)
		}
		for _, ep := range sr.Episodes {
			if ep.Season < 0 || ep.Episode <= 0 || ep.RewatchCount < 0 {
				return nil, fmt.Errorf("épisode invalide dans la sauvegarde (série %d)", sr.TMDBID)
			}
		}
	}
	return &file, nil
}

// orNow : date absente du fichier -> maintenant
func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}

// Import fusionne la sauvegarde avec les données existantes, sans rien supprimer :
// un titre vu le reste, les favoris s'additionnent, on garde le plus grand nombre de revisionnages,
// la date d'ajout la plus ancienne et la dernière activité la plus récente. Réimporter le même fichier ne change rien.
func (s *Service) Import(userID string, file *File) (*ImportResult, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, userID); err != nil {
		return nil, err
	}

	movieStmt, err := tx.Prepare(`
		INSERT INTO user_movies (user_id, tmdb_movie_id, status, is_favorite, rewatch_count, user_rating, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (user_id, tmdb_movie_id) DO UPDATE SET
			status = CASE WHEN user_movies.status = 'watched' THEN 'watched' ELSE EXCLUDED.status END,
			is_favorite = COALESCE(user_movies.is_favorite, FALSE) OR EXCLUDED.is_favorite,
			rewatch_count = GREATEST(user_movies.rewatch_count, EXCLUDED.rewatch_count),
			user_rating = COALESCE(EXCLUDED.user_rating, user_movies.user_rating),
			created_at = LEAST(user_movies.created_at, EXCLUDED.created_at),
			updated_at = GREATEST(user_movies.updated_at, EXCLUDED.updated_at)`)
	if err != nil {
		return nil, err
	}
	defer movieStmt.Close()

	seriesStmt, err := tx.Prepare(`
		INSERT INTO user_series (user_id, tmdb_series_id, status, is_favorite, user_rating, notifications_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (user_id, tmdb_series_id) DO UPDATE SET
			status = CASE WHEN EXCLUDED.status = 'watchlist' THEN user_series.status ELSE EXCLUDED.status END,
			is_favorite = COALESCE(user_series.is_favorite, FALSE) OR EXCLUDED.is_favorite,
			user_rating = COALESCE(EXCLUDED.user_rating, user_series.user_rating),
			notifications_enabled = user_series.notifications_enabled OR EXCLUDED.notifications_enabled,
			created_at = LEAST(user_series.created_at, EXCLUDED.created_at),
			updated_at = GREATEST(user_series.updated_at, EXCLUDED.updated_at)`)
	if err != nil {
		return nil, err
	}
	defer seriesStmt.Close()

	episodeStmt, err := tx.Prepare(`
		INSERT INTO user_episodes (user_id, tmdb_series_id, season_number, episode_number, rewatch_count, first_watched_at, last_watched_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, tmdb_series_id, season_number, episode_number) DO UPDATE SET
			rewatch_count = GREATEST(user_episodes.rewatch_count, EXCLUDED.rewatch_count),
			first_watched_at = LEAST(user_episodes.first_watched_at, EXCLUDED.first_watched_at),
			last_watched_at = GREATEST(user_episodes.last_watched_at, EXCLUDED.last_watched_at)`)
	if err != nil {
		return nil, err
	}
	defer episodeStmt.Close()

	result := &ImportResult{}
	for _, m := range file.Movies {
		if _, err := movieStmt.Exec(userID, m.TMDBID, m.Status, m.IsFavorite, m.RewatchCount, m.Rating, orNow(m.AddedAt), orNow(m.UpdatedAt)); err != nil {
			return nil, fmt.Errorf("film %d : %w", m.TMDBID, err)
		}
		result.Movies++
	}
	for _, sr := range file.Series {
		if _, err := seriesStmt.Exec(userID, sr.TMDBID, sr.Status, sr.IsFavorite, sr.Rating, sr.Notifications, orNow(sr.AddedAt), orNow(sr.UpdatedAt)); err != nil {
			return nil, fmt.Errorf("série %d : %w", sr.TMDBID, err)
		}
		result.Series++
		for _, ep := range sr.Episodes {
			first := orNow(ep.FirstWatchedAt)
			last := ep.LastWatchedAt
			if last.IsZero() || last.Before(first) {
				last = first
			}
			if _, err := episodeStmt.Exec(userID, sr.TMDBID, ep.Season, ep.Episode, ep.RewatchCount, first, last); err != nil {
				return nil, fmt.Errorf("série %d S%dE%d : %w", sr.TMDBID, ep.Season, ep.Episode, err)
			}
			result.Episodes++
		}
	}
	for _, id := range file.Platforms {
		if id <= 0 {
			continue
		}
		if _, err := tx.Exec(`INSERT INTO user_providers (user_id, provider_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, id); err != nil {
			return nil, err
		}
		result.Platforms++
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Durées / dates de sortie manquantes (import sur une autre instance) : utiles aux stats, au Wrapped et au calendrier
	go s.fillMissingMetadata(userID)

	return result, nil
}

// fillMissingMetadata complète movie_metadata / episode_metadata pour les titres importés qui n'en ont pas encore
func (s *Service) fillMissingMetadata(userID string) {
	rows, err := s.db.Query(`
		SELECT um.tmdb_movie_id FROM user_movies um
		LEFT JOIN movie_metadata mm ON mm.tmdb_movie_id = um.tmdb_movie_id
		WHERE um.user_id = $1 AND mm.tmdb_movie_id IS NULL`, userID)
	if err == nil {
		var ids []int
		for rows.Next() {
			var id int
			if rows.Scan(&id) == nil {
				ids = append(ids, id)
			}
		}
		rows.Close()
		for _, id := range ids {
			body, err := s.tmdb.GetMovieDetails(id)
			if err != nil {
				continue
			}
			var details struct {
				Title       string `json:"title"`
				ReleaseDate string `json:"release_date"`
				Runtime     int    `json:"runtime"`
			}
			if json.Unmarshal(body, &details) == nil {
				_, _ = s.db.Exec(`
					INSERT INTO movie_metadata (tmdb_movie_id, title, release_date, runtime, updated_at)
					VALUES ($1, $2, NULLIF($3, '')::DATE, $4, CURRENT_TIMESTAMP)
					ON CONFLICT (tmdb_movie_id) DO NOTHING`, id, details.Title, details.ReleaseDate, details.Runtime)
			}
		}
	}

	// Une requête TMDB par saison couvre tous ses épisodes
	rows, err = s.db.Query(`
		SELECT DISTINCT ue.tmdb_series_id, ue.season_number FROM user_episodes ue
		LEFT JOIN episode_metadata em ON em.tmdb_series_id = ue.tmdb_series_id
			AND em.season_number = ue.season_number AND em.episode_number = ue.episode_number
		WHERE ue.user_id = $1 AND em.tmdb_series_id IS NULL`, userID)
	if err != nil {
		return
	}
	type season struct{ series, number int }
	var seasons []season
	for rows.Next() {
		var sn season
		if rows.Scan(&sn.series, &sn.number) == nil {
			seasons = append(seasons, sn)
		}
	}
	rows.Close()
	for _, sn := range seasons {
		body, err := s.tmdb.GetSeasonDetails(sn.series, sn.number)
		if err != nil {
			continue
		}
		var details struct {
			Episodes []struct {
				EpisodeNumber int    `json:"episode_number"`
				Runtime       int    `json:"runtime"`
				AirDate       string `json:"air_date"`
			} `json:"episodes"`
		}
		if json.Unmarshal(body, &details) != nil {
			continue
		}
		for _, ep := range details.Episodes {
			_, _ = s.db.Exec(`
				INSERT INTO episode_metadata (tmdb_series_id, season_number, episode_number, runtime, air_date, updated_at)
				VALUES ($1, $2, $3, $4, NULLIF($5, '')::DATE, CURRENT_TIMESTAMP)
				ON CONFLICT (tmdb_series_id, season_number, episode_number) DO NOTHING`,
				sn.series, sn.number, ep.EpisodeNumber, ep.Runtime, ep.AirDate)
		}
	}
}

func intPtr(v sql.NullInt64) *int {
	if !v.Valid {
		return nil
	}
	i := int(v.Int64)
	return &i
}
