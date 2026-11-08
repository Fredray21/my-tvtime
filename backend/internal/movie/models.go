package movie

import "time"

type MovieRecord struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	TMDBMovieID  int    `json:"tmdb_movie_id"`
	Status       string `json:"status"` // 'watchlist' ou 'watched'
	IsFavorite   bool   `json:"is_favorite"`
	RewatchCount int    `json:"rewatch_count"`
	ReleaseDate  string `json:"release_date,omitempty"`
	UserRating   *int   `json:"user_rating,omitempty"` // note perso 1-10 (nil = pas noté)

	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}
