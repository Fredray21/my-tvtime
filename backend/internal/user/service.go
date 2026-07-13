package user

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

type UserService struct {
	repo         *Repository
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
}

func NewService(repo *Repository, tmdbClient *tmdb.Client, movieSvc *movie.MovieService) *UserService {
	return &UserService{
		tmdbClient:   tmdbClient,
		repo:         repo,
		movieService: movieSvc,
	}
}

func (s *UserService) GetUserStats(userID string) (UserStatsResponse, error) {
	var stats UserStatsResponse

	var wg sync.WaitGroup
	var mu sync.Mutex

	// 1. On récupère la liste depuis la base de données
	watchedRecords, err := s.repo.GetLatestWatchedMovies(userID, 0)
	if err != nil {
		return stats, err
	}

	batchSize := 20

	// 2. On boucle pour calculer les stats
	for i, record := range watchedRecords {
		totalViews := 1 + record.RewatchCount
		stats.Movies.TotalWatched += totalViews

		wg.Add(1)

		go func(rec movie.MovieRecord, views int) {
			defer wg.Done() // Dit au WaitGroup que cette goroutine a fini son travail

			tmdbBytes, err := s.tmdbClient.GetMovieDetails(rec.TMDBMovieID)
			if err != nil {
				return
			}

			// 2. On décode le JSON de TMDB dans notre structure de film complète
			var details movie.TMDBMovieResult
			if err := json.Unmarshal(tmdbBytes, &details); err != nil {
				return
			}

			mu.Lock()
			stats.Movies.TotalRuntimeMinutes += details.Runtime * views
			mu.Unlock()
		}(record, totalViews)

		if (i+1)%batchSize == 0 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	wg.Wait()

	// 3. Simulation des Séries en attendant d'avoir la table user_tv
	stats.TV.TotalEpisodesWatched = 450
	stats.TV.TotalRuntimeMinutes = 20250

	return stats, nil
}

func (s *UserService) GetLatestWatchedMovies(userID string, limit int) ([]movie.MovieCustomResponse, error) {
	records, err := s.repo.GetLatestWatchedMovies(userID, limit)
	if err != nil {
		return nil, err
	}

	movieRecords := make([]movie.MovieRecord, len(records))
	for i, r := range records {
		movieRecords[i] = movie.MovieRecord{TMDBMovieID: r.TMDBMovieID, RewatchCount: r.RewatchCount, IsFavorite: r.IsFavorite, Status: r.Status}
	}

	return s.movieService.EnrichMovieRecords(userID, movieRecords)
}
