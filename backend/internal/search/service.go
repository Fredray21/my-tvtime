package search

import (
	"encoding/json"
	"fmt"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

type TMDBSearchResponse struct {
	Results      []movie.MovieCustomResponse `json:"results"`
	Page         int                         `json:"page"`
	TotalPages   int                         `json:"total_pages"`
	TotalResults int                         `json:"total_results"`
}

type MultiSearchFrontResponse struct {
	Movies  []movie.MovieCustomResponse `json:"movies"`
	TVShows []movie.MovieCustomResponse `json:"tvShows"`
	Actors  []movie.MovieCustomResponse `json:"actors"`
}

type SearchService struct {
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService // 🟢 On injecte le SERVICE au lieu du REPO
}

func NewService(tmdbClient *tmdb.Client, movieSvc *movie.MovieService) *SearchService {
	return &SearchService{
		tmdbClient:   tmdbClient,
		movieService: movieSvc,
	}
}

// GetMultiSearch récupère, trie et enrichit les résultats
func (s *SearchService) GetMultiSearch(userID string, query string) (*MultiSearchFrontResponse, error) {
	tmdbBytes, err := s.tmdbClient.SearchMulti(query)
	if err != nil {
		return nil, err
	}

	var tmdbData TMDBSearchResponse
	if err := json.Unmarshal(tmdbBytes, &tmdbData); err != nil {
		return nil, fmt.Errorf("échec unmarshal multi search: %w", err)
	}

	response := &MultiSearchFrontResponse{
		Movies:  make([]movie.MovieCustomResponse, 0),
		TVShows: make([]movie.MovieCustomResponse, 0),
		Actors:  make([]movie.MovieCustomResponse, 0),
	}

	for _, item := range tmdbData.Results {
		switch item.MediaType {
		case "movie":
			response.Movies = append(response.Movies, item)
		case "tv":
			response.TVShows = append(response.TVShows, item)
		case "person":
			response.Actors = append(response.Actors, item)
		}
	}

	// Enrich
	if len(response.Movies) > 0 {
		response.Movies, _ = s.movieService.EnrichWithUserStatus(userID, response.Movies)
	}

	return response, nil
}

// GetPagedSearch gère les onglets spécifiques (sans tri, juste de l'enrichissement si c'est un film)
func (s *SearchService) GetPagedSearch(userID string, searchType string, query string, page int) (*TMDBSearchResponse, error) {
	tmdbBytes, err := s.tmdbClient.SearchPaged(searchType, query, page)
	if err != nil {
		return nil, err
	}

	var tmdbData TMDBSearchResponse
	if err := json.Unmarshal(tmdbBytes, &tmdbData); err != nil {
		return nil, fmt.Errorf("échec unmarshal paged search: %w", err)
	}

	// Si c'est une recherche de films, on enrichit le statut
	if searchType == "movie" && len(tmdbData.Results) > 0 {
		tmdbData.Results, _ = s.movieService.EnrichWithUserStatus(userID, tmdbData.Results)
	}

	return &tmdbData, nil
}
