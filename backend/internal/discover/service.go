package discover

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/providers"
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
		// Populaires sur les plateformes de l'utilisateur (paramètres ajoutés à la volée)
		MyPlatformsList: {path: "discover/movie"},
	},
	"tv": {
		"trending":      {path: "trending/tv/week"},
		"popular":       {path: "tv/popular"},
		"on_the_air":    {path: "tv/on_the_air"},
		"top_rated":     {path: "tv/top_rated"},
		MyPlatformsList: {path: "discover/tv"},
	},
}

// MyPlatformsList : liste "Sur tes plateformes", construite à partir de "Mes plateformes"
const MyPlatformsList = "my_platforms"

// myPlatformsQuery : titres inclus dans l'abonnement (pas la location / l'achat) sur les plateformes choisies
func myPlatformsQuery(providerIDs []int) string {
	ids := make([]string, len(providerIDs))
	for i, id := range providerIDs {
		ids[i] = strconv.Itoa(id)
	}
	return "watch_region=" + providers.Region +
		"&with_watch_providers=" + strings.Join(ids, "|") +
		"&with_watch_monetization_types=flatrate|free|ads" +
		"&sort_by=popularity.desc&vote_count.gte=50"
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
	tmdbClient       *tmdb.Client
	movieService     *movie.MovieService
	tvService        *tv.TVService
	providersService *providers.Service
}

func NewService(tmdbClient *tmdb.Client, movieSvc *movie.MovieService, tvSvc *tv.TVService, providersSvc *providers.Service) *Service {
	return &Service{tmdbClient: tmdbClient, movieService: movieSvc, tvService: tvSvc, providersService: providersSvc}
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

	query := def.query
	if list == MyPlatformsList {
		ids, err := s.providersService.MatchIDs(userID)
		if err != nil {
			return nil, err
		}
		if len(ids) == 0 {
			// Aucune plateforme choisie : liste vide (le front propose alors de les choisir)
			if mediaType == "movie" {
				return newPaged([]movie.MovieCustomResponse{}, page, 0), nil
			}
			return newPaged([]tv.SeriesCustomResponse{}, page, 0), nil
		}
		query = myPlatformsQuery(ids)
	}

	body, err := s.tmdbClient.GetList(def.path, query, page)
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
		if list == MyPlatformsList {
			ids := make([]int, len(data.Results))
			for i := range data.Results {
				ids[i] = data.Results[i].ID
			}
			for i, available := range s.availability("movie", ids) {
				data.Results[i].AvailableOn = available
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
	if list == MyPlatformsList {
		ids := make([]int, len(data.Results))
		for i := range data.Results {
			ids[i] = data.Results[i].ID
		}
		for i, available := range s.availability("tv", ids) {
			data.Results[i].AvailableOn = available
		}
	}
	return newPaged(data.Results, data.Page, data.TotalPages), nil
}

// availability récupère les plateformes (France) de chaque titre : les listes TMDB ne les incluent pas,
// or la liste "Sur tes plateformes" doit afficher sur quelle plateforme regarder.
// Appels en parallèle (bornés), mis en cache 24h par le client TMDB. nil = inconnu (erreur).
func (s *Service) availability(mediaType string, ids []int) []*providers.Streaming {
	out := make([]*providers.Streaming, len(ids))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i, id := range ids {
		wg.Add(1)
		go func(i, id int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			body, err := s.tmdbClient.GetWatchProviders(mediaType, id)
			if err != nil {
				return
			}
			var available providers.Streaming
			if err := json.Unmarshal(body, &available); err != nil {
				return
			}
			if available == nil {
				available = providers.Streaming{}
			}
			out[i] = &available
		}(i, id)
	}
	wg.Wait()
	return out
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
