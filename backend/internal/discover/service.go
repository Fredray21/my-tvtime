package discover

import (
	"encoding/json"
	"fmt"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/tv"
)

// TMDB refuse les pages au-delà de 500
const maxTMDBPage = 500

// tmdbList décrit une liste de découverte : chemin TMDB + paramètres éventuels
type tmdbList struct {
	path  string
	query string
}

// Listes autorisées, par type de média. Le cache TMDB (24h) suffit : les tendances bougent au jour le jour.
var lists = map[string]map[string]tmdbList{
	"movie": {
		"trending":    {path: "trending/movie/week"},
		"now_playing": {path: "movie/now_playing", query: "region=FR"},
		"upcoming":    {path: "movie/upcoming", query: "region=FR"},
		"popular":     {path: "movie/popular", query: "region=FR"},
		"top_rated":   {path: "movie/top_rated"},
	},
	"tv": {
		"trending":   {path: "trending/tv/week"},
		"popular":    {path: "tv/popular"},
		"on_the_air": {path: "tv/on_the_air"},
		"top_rated":  {path: "tv/top_rated"},
	},
}

// IsValidList indique si le couple (type, liste) est géré
func IsValidList(mediaType, list string) bool {
	_, ok := lists[mediaType][list]
	return ok
}

// PagedResponse : même forme que les autres listes paginées du front (has_next_page)
type PagedResponse[T any] struct {
	Results     []T  `json:"results"`
	Page        int  `json:"page"`
	TotalPages  int  `json:"total_pages"`
	HasNextPage bool `json:"has_next_page"`
}

type Service struct {
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
	tvService    *tv.TVService
}

func NewService(tmdbClient *tmdb.Client, movieSvc *movie.MovieService, tvSvc *tv.TVService) *Service {
	return &Service{tmdbClient: tmdbClient, movieService: movieSvc, tvService: tvSvc}
}

// GetList renvoie une page d'une liste de découverte, enrichie avec le statut de l'utilisateur
func (s *Service) GetList(userID, mediaType, list string, page int) (interface{}, error) {
	def, ok := lists[mediaType][list]
	if !ok {
		return nil, fmt.Errorf("liste inconnue: %s/%s", mediaType, list)
	}
	if page > maxTMDBPage {
		page = maxTMDBPage
	}

	body, err := s.tmdbClient.GetList(def.path, def.query, page)
	if err != nil {
		return nil, err
	}

	if mediaType == "movie" {
		var data struct {
			Results    []movie.MovieCustomResponse `json:"results"`
			Page       int                         `json:"page"`
			TotalPages int                         `json:"total_pages"`
		}
		if err := json.Unmarshal(body, &data); err != nil {
			return nil, fmt.Errorf("échec unmarshal liste %s: %w", list, err)
		}
		for i := range data.Results {
			data.Results[i].MediaType = "movie"
		}
		if len(data.Results) > 0 {
			if enriched, err := s.movieService.EnrichWithUserStatus(userID, data.Results); err == nil {
				data.Results = enriched
			}
		}
		return newPaged(data.Results, data.Page, data.TotalPages), nil
	}

	var data struct {
		Results    []tv.SeriesCustomResponse `json:"results"`
		Page       int                       `json:"page"`
		TotalPages int                       `json:"total_pages"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("échec unmarshal liste %s: %w", list, err)
	}
	for i := range data.Results {
		data.Results[i].MediaType = "tv"
	}
	if len(data.Results) > 0 {
		if enriched, err := s.tvService.EnrichWithUserStatus(userID, data.Results); err == nil {
			data.Results = enriched
		}
	}
	return newPaged(data.Results, data.Page, data.TotalPages), nil
}

func newPaged[T any](results []T, page, totalPages int) PagedResponse[T] {
	if results == nil {
		results = make([]T, 0)
	}
	if totalPages > maxTMDBPage {
		totalPages = maxTMDBPage
	}
	return PagedResponse[T]{
		Results:     results,
		Page:        page,
		TotalPages:  totalPages,
		HasNextPage: page < totalPages,
	}
}
