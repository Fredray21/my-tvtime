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

	return s.repo.SaveMovieStatus(userID, tmdbMovieID, status, isFavorite, rewatchCount, watchedAt)
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
	// 1. On appelle le client TMDB pour récupérer les détails complets en bytes
	tmdbBytes, err := s.tmdbClient.GetMovieDetails(movieID)
	if err != nil {
		return nil, fmt.Errorf("erreur lors de la récupération des détails TMDB: %w", err)
	}

	// 2. On décode le JSON de TMDB dans notre structure de film complète
	var tmdbMovie TMDBMovieResult
	if err := json.Unmarshal(tmdbBytes, &tmdbMovie); err != nil {
		return nil, fmt.Errorf("échec de la désérialisation (unmarshal) des détails TMDB: %w", err)
	}

	// 3. On initialise notre réponse personnalisée avec les données TMDB et des valeurs par défaut
	customMovie := &MovieCustomResponse{
		TMDBMovieResult: tmdbMovie,
	}

	// 4. On interroge notre base de données locale pour voir si l'utilisateur a déjà interagi avec ce film
	record, err := s.repo.GetMovieStatus(userID, movieID)
	if err != nil {
		// Si la BDD a un problème, on log l'erreur mais on ne bloque pas l'affichage du film
		fmt.Printf("Erreur lors de la récupération du statut en BDD pour le film %d: %v\n", movieID, err)
		return customMovie, nil
	}

	// 5. Si le film existe en BDD, on écrase les valeurs par défaut par les vraies valeurs de l'utilisateur
	if record != nil {
		customMovie.StatusLocal = record.Status
		customMovie.IsFavorite = record.IsFavorite
		customMovie.RewatchCount = record.RewatchCount
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
