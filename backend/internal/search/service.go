package search

import (
	"encoding/json"
	"fmt"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/tv"
)

type TMDBSearchPerson struct {
	ID          int    `json:"id"`
	MediaType   string `json:"media_type"`
	Name        string `json:"name"`
	ProfilePath string `json:"profile_path"`
}

type MultiSearchFrontResponse struct {
	Movies  []movie.MovieCustomResponse `json:"movies"`
	TVShows []tv.SeriesCustomResponse   `json:"tvShows"`
	Actors  []TMDBSearchPerson          `json:"actors"`
}

type SearchService struct {
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
	tvService    *tv.TVService
}

type TMDBSearchResponse struct {
	Results      []movie.MovieCustomResponse `json:"results"`
	Page         int                         `json:"page"`
	TotalPages   int                         `json:"total_pages"`
	TotalResults int                         `json:"total_results"`
}

func NewService(tmdbClient *tmdb.Client, movieSvc *movie.MovieService, tvSvc *tv.TVService) *SearchService {
	return &SearchService{
		tmdbClient:   tmdbClient,
		movieService: movieSvc,
		tvService:    tvSvc,
	}
}

// GetMultiSearch récupère, trie et enrichit les résultats
func (s *SearchService) GetMultiSearch(userID string, query string) (*MultiSearchFrontResponse, error) {
	tmdbBytes, err := s.tmdbClient.SearchMulti(query)
	if err != nil {
		return nil, err
	}

	// On lit les résultats sous forme de "JSON brut" pour pouvoir les trier
	var rawData struct {
		Results []json.RawMessage `json:"results"`
	}
	if err := json.Unmarshal(tmdbBytes, &rawData); err != nil {
		return nil, fmt.Errorf("échec unmarshal multi search: %w", err)
	}

	response := &MultiSearchFrontResponse{
		Movies:  make([]movie.MovieCustomResponse, 0),
		TVShows: make([]tv.SeriesCustomResponse, 0),
		Actors:  make([]TMDBSearchPerson, 0),
	}

	// Pour chaque résultat brut, on vérifie le type, puis on décode dans la bonne structure !
	for _, rawItem := range rawData.Results {
		var typeChecker struct {
			MediaType string `json:"media_type"`
		}
		json.Unmarshal(rawItem, &typeChecker)

		switch typeChecker.MediaType {
		case "movie":
			var m movie.MovieCustomResponse
			json.Unmarshal(rawItem, &m)
			m.MediaType = "movie"
			response.Movies = append(response.Movies, m)
		case "tv":
			var t tv.SeriesCustomResponse
			json.Unmarshal(rawItem, &t)
			t.MediaType = "tv"
			response.TVShows = append(response.TVShows, t)
		case "person":
			var p TMDBSearchPerson
			json.Unmarshal(rawItem, &p)
			p.MediaType = "person"
			response.Actors = append(response.Actors, p)
		}
	}

	// Enrichissement complet (Films ET Séries) avec le statut de l'utilisateur !
	if len(response.Movies) > 0 {
		response.Movies, _ = s.movieService.EnrichWithUserStatus(userID, response.Movies)
	}
	if len(response.TVShows) > 0 {
		response.TVShows, _ = s.tvService.EnrichWithUserStatus(userID, response.TVShows)
	}

	return response, nil
}

// GetPagedSearch gère les onglets spécifiques (sans tri, juste de l'enrichissement si c'est un film)
func (s *SearchService) GetPagedSearch(userID string, searchType string, query string, page int) (interface{}, error) {
	tmdbBytes, err := s.tmdbClient.SearchPaged(searchType, query, page)
	if err != nil {
		return nil, err
	}

	// Selon l'onglet, on décode et on enrichit spécifiquement
	switch searchType {
	case "movie":
		var tmdbData struct {
			Results      []movie.MovieCustomResponse `json:"results"`
			Page         int                         `json:"page"`
			TotalPages   int                         `json:"total_pages"`
			TotalResults int                         `json:"total_results"`
		}
		json.Unmarshal(tmdbBytes, &tmdbData)
		tmdbData.Results, _ = s.movieService.EnrichWithUserStatus(userID, tmdbData.Results)
		return tmdbData, nil

	case "tv":
		var tmdbData struct {
			Results      []tv.SeriesCustomResponse `json:"results"`
			Page         int                       `json:"page"`
			TotalPages   int                       `json:"total_pages"`
			TotalResults int                       `json:"total_results"`
		}
		json.Unmarshal(tmdbBytes, &tmdbData)
		tmdbData.Results, _ = s.tvService.EnrichWithUserStatus(userID, tmdbData.Results)
		return tmdbData, nil

	default: // "person"
		var tmdbData struct {
			Results      []TMDBSearchPerson `json:"results"`
			Page         int                `json:"page"`
			TotalPages   int                `json:"total_pages"`
			TotalResults int                `json:"total_results"`
		}
		json.Unmarshal(tmdbBytes, &tmdbData)
		return tmdbData, nil
	}
}
