package user

import (
	"database/sql"

	"github.com/Fredray21/my-tvtime/internal/movie"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// EnsureUserExists fait l'upsert JIT au niveau global
func (r *Repository) EnsureUserExists(clerkUserID string) error {
	query := `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`
	_, err := r.db.Exec(query, clerkUserID)
	return err
}

// GetUserWatchedMovies récupère les IDs et le nombre de visionnages des films vus
func (r *Repository) GetLatestWatchedMovies(userID string, limit int) ([]movie.MovieRecord, error) {
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

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []movie.MovieRecord
	for rows.Next() {
		var rec movie.MovieRecord
		err := rows.Scan(&rec.ID, &rec.UserID, &rec.TMDBMovieID, &rec.Status, &rec.IsFavorite, &rec.RewatchCount)

		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}
