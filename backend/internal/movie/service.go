package movie

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// Les sous-structures pour décoder les tableaux dans le JSON de TMDB
type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type ProductionCompany struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	LogoPath string `json:"logo_path"`
}

// TMDBMovieResult s'enrichit au maximum pour la page de détails
type TMDBMovieResult struct {
	ID                  int                 `json:"id"`
	Title               string              `json:"title"`
	OriginalTitle       string              `json:"original_title"`
	PosterPath          string              `json:"poster_path"`
	BackdropPath        string              `json:"backdrop_path"`
	Overview            string              `json:"overview"`
	ReleaseDate         string              `json:"release_date"`
	VoteAverage         float64             `json:"vote_average"`
	Runtime             int                 `json:"runtime"`
	Tagline             string              `json:"tagline"`
	Genres              []Genre             `json:"genres"`
	ProductionCompanies []ProductionCompany `json:"production_companies"`
	Budget              int64               `json:"budget"`
	Revenue             int64               `json:"revenue"`
	Status              string              `json:"status"` // Statut de sortie (ex: "Released")
}

// TMDBSearchResponse représente la réponse globale de recherche TMDB
type TMDBSearchResponse struct {
	Results []TMDBMovieResult `json:"results"`
}

// MovieCustomResponse est la structure finale renvoyée à ton React PWA
// Elle fusionne les données de TMDB et les données personnalisées de ta BDD
type MovieCustomResponse struct {
	TMDBMovieResult
	StatusLocal  string `json:"status_local"` // 'watchlist', 'watched' ou 'not_tracked' (On renomme le json pour ne pas écraser le status TMDB)
	IsFavorite   bool   `json:"is_favorite"`
	RewatchCount int    `json:"rewatch_count"`
	MediaType    string `json:"media_type"`

	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

type MovieService struct {
	repo       *Repository
	tmdbClient *tmdb.Client
}

func NewService(repo *Repository, tmdbClient *tmdb.Client) *MovieService {
	return &MovieService{
		repo:       repo,
		tmdbClient: tmdbClient,
	}
}

func (s *MovieService) UpdateMovieStatus(userID string, tmdbMovieID int, status string, isFavorite bool, rewatchCount int, watchedAt time.Time) error {
	if status != "watchlist" && status != "watched" {
		return fmt.Errorf("statut invalide: %s", status)
	}

	finalUpdatedAt := watchedAt
	if finalUpdatedAt.IsZero() {
		finalUpdatedAt = time.Now()
	}

	record, err := s.repo.GetMovieStatus(userID, tmdbMovieID)
	if err == nil && record != nil {
		// On considère que c'est un "nouveau visionnage" SEULEMENT SI :
		// - Le film passe en "watched" pour la toute première fois
		// - OU le compteur de rewatch a augmenté
		isNewWatch := (status == "watched" && record.Status != "watched") || (rewatchCount > record.RewatchCount)

		// Si ce n'est PAS un nouveau visionnage (ex: juste un toggle favori ou un retrait),
		if !isNewWatch {
			finalUpdatedAt = record.UpdatedAt
		}
	}

	go func() {
		tmdbBytes, err := s.tmdbClient.GetMovieDetails(tmdbMovieID)
		if err == nil {
			var tmdbMovie TMDBMovieResult
			if json.Unmarshal(tmdbBytes, &tmdbMovie) == nil {
				_ = s.repo.SaveMovieMetadata(tmdbMovieID, tmdbMovie.Title, tmdbMovie.ReleaseDate, tmdbMovie.Runtime)
			}
		}
	}()

	return s.repo.SaveMovieStatus(userID, tmdbMovieID, status, isFavorite, rewatchCount, finalUpdatedAt)
}

// 3. LOGIQUE MÉTIER : Supprime un film de la liste de l'utilisateur
func (s *MovieService) RemoveMovie(userID string, tmdbMovieID int) error {
	return s.repo.DeleteMovie(userID, tmdbMovieID)
}

// GetWatchlistForUser orchestre la récupération de la watchlist enrichie par TMDB
func (s *MovieService) GetWatchlistForUser(userID string, page int) ([]MovieCustomResponse, error) {
	limit := 20

	records, err := s.repo.GetMoviesByStatusRecords(userID, "watchlist", page, limit)
	if err != nil {
		return nil, err
	}

	return s.EnrichMovieRecords(userID, records)
}

// GetFavoritesForUser orchestre la récupération des favoris enrichis par TMDB
func (s *MovieService) GetFavoritesForUser(userID string) ([]MovieCustomResponse, error) {
	records, err := s.repo.GetFavoriteMoviesRecords(userID)
	if err != nil {
		return nil, err
	}

	return s.EnrichMovieRecords(userID, records)
}

// GetMovieDetailsForUser récupère la fiche complète d'un film depuis TMDB et y injecte le statut local de l'utilisateur
func (s *MovieService) GetMovieDetailsForUser(userID string, movieID int) (*MovieCustomResponse, error) {
	tmdbBytes, err := s.tmdbClient.GetMovieDetails(movieID)
	if err != nil {
		return nil, fmt.Errorf("erreur lors de la récupération des détails TMDB: %w", err)
	}

	var tmdbMovie TMDBMovieResult
	if err := json.Unmarshal(tmdbBytes, &tmdbMovie); err != nil {
		return nil, fmt.Errorf("échec de la désérialisation (unmarshal) des détails TMDB: %w", err)
	}

	go func() {
		_ = s.repo.SaveMovieMetadata(movieID, tmdbMovie.Title, tmdbMovie.ReleaseDate, tmdbMovie.Runtime)
	}()

	customMovie := &MovieCustomResponse{
		TMDBMovieResult: tmdbMovie,
		MediaType:       "movie",
	}

	record, err := s.repo.GetMovieStatus(userID, movieID)
	if err != nil {
		// Si la BDD a un problème, on log l'erreur mais on ne bloque pas l'affichage du film
		fmt.Printf("Erreur lors de la récupération du statut en BDD pour le film %d: %v\n", movieID, err)
		return customMovie, nil
	}

	if record != nil {
		customMovie.StatusLocal = record.Status
		customMovie.IsFavorite = record.IsFavorite
		customMovie.RewatchCount = record.RewatchCount

		customMovie.CreatedAt = record.CreatedAt
		customMovie.UpdatedAt = record.UpdatedAt
	}

	return customMovie, nil
}

func (s *MovieService) GetSimilarMovies(userID string, movieID int) ([]MovieCustomResponse, error) {
	// Appel TMDB : /movie/{movie_id}/recommendations
	tmdbBytes, err := s.tmdbClient.GetSimilarMovie(movieID)
	if err != nil {
		return nil, err
	}

	var response struct {
		Results []MovieCustomResponse `json:"results"`
	}
	json.Unmarshal(tmdbBytes, &response)

	return s.EnrichWithUserStatus(userID, response.Results)
}

func (s *MovieService) GetUpcomingMovies(userID string, page int) ([]MovieCustomResponse, error) {
	limit := 20
	records, err := s.repo.GetUpcomingMoviesRecords(userID, page, limit)
	if err != nil {
		return nil, err
	}
	return s.EnrichMovieRecords(userID, records)
}

func (s *MovieService) GetMovieCredits(tmdbMovieID int) (map[string]interface{}, error) {
    data, err := s.tmdbClient.GetCredits(tmdbMovieID, "movie")
    if err != nil {
        return nil, err
    }
    
    var credits map[string]interface{}
    if err := json.Unmarshal(data, &credits); err != nil {
        return nil, err
    }
    return credits, nil
}