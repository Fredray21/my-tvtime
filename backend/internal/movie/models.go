package movie

type MovieRecord struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	TMDBMovieID  int    `json:"tmdb_movie_id"`
	Status       string `json:"status"` // 'watchlist' ou 'watched'
	IsFavorite   bool   `json:"is_favorite"`
	RewatchCount int    `json:"rewatch_count"`
}
