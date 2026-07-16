package movie

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

// 1. UPSERT : Ajoute ou met à jour le statut d'un film (Watchlist, Vu, Favori...)
// Grâce à ON CONFLICT, on gère la création et la modification au même endroit.
func (r *Repository) SaveMovieStatus(userID string, tmdbMovieID int, status string, isFavorite bool, rewatchCount int, watchedAt time.Time) error {
	if watchedAt.IsZero() {
		watchedAt = time.Now()
	}

	query := `
		INSERT INTO user_movies (user_id, tmdb_movie_id, status, is_favorite, rewatch_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, tmdb_movie_id)
		DO UPDATE SET 
			status = EXCLUDED.status,
			is_favorite = EXCLUDED.is_favorite,
			rewatch_count = EXCLUDED.rewatch_count,
			updated_at = EXCLUDED.updated_at;
	`
	_, err := r.db.Exec(query, userID, tmdbMovieID, status, isFavorite, rewatchCount, watchedAt, watchedAt)
	return err
}

// 2. READ : Récupère le statut d'un film spécifique pour un utilisateur donné
func (r *Repository) GetMovieStatus(userID string, tmdbMovieID int) (*MovieRecord, error) {
	query := `
		SELECT id, user_id, tmdb_movie_id, status, is_favorite, rewatch_count, created_at, updated_at 
		FROM user_movies 
		WHERE user_id = $1 AND tmdb_movie_id = $2
	`
	var movie MovieRecord
	err := r.db.QueryRow(query, userID, tmdbMovieID).Scan(
		&movie.ID, &movie.UserID, &movie.TMDBMovieID,
		&movie.Status, &movie.IsFavorite, &movie.RewatchCount, &movie.CreatedAt, &movie.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Le film n'est pas encore dans la liste de l'utilisateur, ce n'est pas une erreur critique
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &movie, nil
}

// GetMoviesByStatusRecords récupère tous les films ayant un statut spécifique ('watchlist' ou 'watched')
// Ajoute page et limit en paramètres
func (r *Repository) GetMoviesByStatusRecords(userID string, status string, page int, limit int) ([]MovieRecord, error) {
	offset := (page - 1) * limit

	// On ajoute LIMIT et OFFSET à la requête SQL
	query := `
		SELECT tmdb_movie_id, status, is_favorite, rewatch_count, created_at, updated_at 
		FROM user_movies 
		WHERE user_id = $1 AND status = $2
		ORDER BY updated_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(query, userID, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MovieRecord
	for rows.Next() {
		var rec MovieRecord
		err := rows.Scan(&rec.TMDBMovieID, &rec.Status, &rec.IsFavorite, &rec.RewatchCount, &rec.CreatedAt, &rec.UpdatedAt)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// GetFavoriteMoviesRecords récupère tous les films marqués en favori par l'utilisateur
func (r *Repository) GetFavoriteMoviesRecords(userID string) ([]MovieRecord, error) {
	query := `
		SELECT id, user_id, tmdb_movie_id, status, is_favorite, rewatch_count, created_at, updated_at 
		FROM user_movies 
		WHERE user_id = $1 AND is_favorite = true
		ORDER BY updated_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MovieRecord
	for rows.Next() {
		var m MovieRecord
		if err := rows.Scan(&m.ID, &m.UserID, &m.TMDBMovieID, &m.Status, &m.IsFavorite, &m.RewatchCount, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, m)
	}
	return records, nil
}

// 4. DELETE : Supprime complètement un film de la liste de l'utilisateur
func (r *Repository) DeleteMovie(userID string, tmdbMovieID int) error {
	query := `DELETE FROM user_movies WHERE user_id = $1 AND tmdb_movie_id = $2`
	result, err := r.db.Exec(query, userID, tmdbMovieID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("movie not found in user list")
	}

	return nil
}

// GetUserStatusesForMovies
type MovieStatus struct {
	Status     string
	IsFavorite bool
}

func (r *Repository) GetUserStatusesForMovies(userID string, tmdbIDs []int) (map[int]MovieStatus, error) {
	if len(tmdbIDs) == 0 {
		return make(map[int]MovieStatus), nil
	}

	// Utilisation de ANY($1) pour passer une slice d'entiers directement à Postgres
	query := `
        SELECT tmdb_movie_id, status, is_favorite 
        FROM user_movies 
        WHERE user_id = $1 AND tmdb_movie_id = ANY($2)
    `

	// Note : r.db est ici supposé être une connexion *pgx.Pool ou *sql.DB
	// Si tu utilises pgx, tu peux passer la slice directement comme un array Postgres
	rows, err := r.db.Query(query, userID, tmdbIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// On stocke le résultat dans une map pour un accès rapide : ID -> Status
	results := make(map[int]MovieStatus)
	for rows.Next() {
		var tmdbID int
		var ms MovieStatus
		err := rows.Scan(&tmdbID, &ms.Status, &ms.IsFavorite)
		if err != nil {
			return nil, err
		}
		results[tmdbID] = ms
	}

	return results, nil
}

// GetUserWatchedMovies récupère les IDs et le nombre de visionnages des films vus
func (r *Repository) GetLatestWatchedMovies(userID string, limit, offset int) ([]MovieRecord, error) {
	query := `
        SELECT id, user_id, tmdb_movie_id, status, is_favorite, rewatch_count  
        FROM user_movies 
        WHERE user_id = $1 AND status = 'watched' 
        ORDER BY updated_at DESC
    `

	args := []interface{}{userID}

	if limit > 0 {
		query += " LIMIT $2"
		args = append(args, limit)
	}

	if offset > 0 {
		query += " OFFSET $3"
		args = append(args, offset)
	}

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MovieRecord
	for rows.Next() {
		var rec MovieRecord
		err := rows.Scan(&rec.ID, &rec.UserID, &rec.TMDBMovieID, &rec.Status, &rec.IsFavorite, &rec.RewatchCount)

		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

func (r *Repository) GetMovieStatsCalculated(userID string) (int, int, error) {
	query := `
		SELECT COALESCE(SUM(1 + um.rewatch_count), 0), 
		       COALESCE(SUM(mm.runtime * (1 + um.rewatch_count)), 0)
		FROM user_movies um
		LEFT JOIN movie_metadata mm ON um.tmdb_movie_id = mm.tmdb_movie_id
		WHERE um.user_id = $1 AND um.status = 'watched'`

	var totalViews, totalMinutes int
	err := r.db.QueryRow(query, userID).Scan(&totalViews, &totalMinutes)
	return totalViews, totalMinutes, err
}

func (r *Repository) SaveMovieMetadata(tmdbID int, title string, releaseDate string, runtime int) error {
	query := `
		INSERT INTO movie_metadata (tmdb_movie_id, title, release_date, runtime, updated_at)
		VALUES ($1, $2, NULLIF($3, '')::DATE, $4, CURRENT_TIMESTAMP)
		ON CONFLICT (tmdb_movie_id) DO UPDATE SET
			title = EXCLUDED.title,
			release_date = EXCLUDED.release_date,
			runtime = EXCLUDED.runtime,
			updated_at = CURRENT_TIMESTAMP;
	`
	_, err := r.db.Exec(query, tmdbID, title, releaseDate, runtime)
	return err
}

func (r *Repository) GetUpcomingMoviesRecords(userID string, page int, limit int) ([]MovieRecord, error) {
	offset := (page - 1) * limit

	// On JOIN avec movie_metadata et on filtre : release_date > CURRENT_DATE
	// On trie par date de sortie croissante (le plus proche en premier)
	query := `
        SELECT um.tmdb_movie_id, um.status, um.is_favorite, um.rewatch_count, um.created_at, um.updated_at, mm.release_date
        FROM user_movies um
        JOIN movie_metadata mm ON um.tmdb_movie_id = mm.tmdb_movie_id
        WHERE um.user_id = $1 AND um.status = 'watchlist' AND mm.release_date > CURRENT_DATE
        ORDER BY mm.release_date ASC
        LIMIT $2 OFFSET $3
    `

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MovieRecord
	for rows.Next() {
		var rec MovieRecord
		err := rows.Scan(&rec.TMDBMovieID, &rec.Status, &rec.IsFavorite, &rec.RewatchCount, &rec.ReleaseDate, &rec.CreatedAt, &rec.UpdatedAt)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// Dans movie_repository.go
func (r *Repository) GetMovieCredits(tmdbMovieID int) ([]byte, error) {
    endpoint := fmt.Sprintf("/movie/%d/credits?api_key=%s&language=fr-FR", tmdbMovieID, r.apiKey)
    return r.tmdbClient.DoRequest(endpoint)
}