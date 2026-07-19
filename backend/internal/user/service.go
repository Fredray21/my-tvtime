package user

import (
	"fmt"
	"sync"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/tv"
)

type UserService struct {
	repo         *Repository
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
	tvService    *tv.TVService
	movieRepo    *movie.Repository
	tvRepo       *tv.Repository
}

func NewService(repo *Repository, tmdbClient *tmdb.Client, movieSvc *movie.MovieService, tvSvc *tv.TVService, movieRepo *movie.Repository, tvRepo *tv.Repository) *UserService {
	return &UserService{
		tmdbClient:   tmdbClient,
		repo:         repo,
		movieService: movieSvc,
		tvService:    tvSvc,
		movieRepo:    movieRepo,
		tvRepo:       tvRepo,
	}
}

func (s *UserService) GetUserStats(userID string) (UserStatsResponse, error) {
	var stats UserStatsResponse

	movieStats, err := s.GetMovieStats(userID)
	if err != nil {
		return stats, err
	}
	stats.Movies = movieStats

	tvStats, err := s.GetTVStats(userID)
	if err != nil {
		return stats, err
	}
	stats.TV = tvStats

	return stats, nil
}

func (s *UserService) GetLatestWatchedMovies(userID string, page, limit int) ([]movie.MovieCustomResponse, error) {
	offset := (page - 1) * limit

	records, err := s.movieRepo.GetLatestWatchedMovies(userID, limit+1, offset)
	if err != nil {
		return nil, err
	}

	movieRecords := make([]movie.MovieRecord, len(records))
	for i, r := range records {
		movieRecords[i] = movie.MovieRecord{TMDBMovieID: r.TMDBMovieID, RewatchCount: r.RewatchCount, IsFavorite: r.IsFavorite, Status: r.Status}
	}

	return s.movieService.EnrichMovieRecords(userID, movieRecords)
}

func (s *UserService) GetLatestWatchedTV(userID string, page, limit int) ([]tv.SeriesCustomResponse, error) {
	offset := (page - 1) * limit

	records, err := s.tvRepo.GetLatestWatchedEpisodes(userID, limit+1, offset)
	if err != nil {
		return nil, err
	}

	enriched := make([]tv.SeriesCustomResponse, len(records))
	var wg sync.WaitGroup

	for i, rec := range records {
		wg.Add(1)

		go func(index int, seriesID int) {
			defer wg.Done()

			details, err := s.tvService.GetSeriesDetailsForUser(userID, seriesID)
			if err == nil && details != nil {
				enriched[index] = *details
			} else {
				fmt.Printf("Erreur lors de la récupération de la série %d: %v\n", seriesID, err)
			}
		}(i, rec.TMDBSeriesID)
	}

	wg.Wait()

	var finalResults []tv.SeriesCustomResponse
	for _, res := range enriched {
		if res.ID != 0 {
			finalResults = append(finalResults, res)
		}
	}

	return finalResults, nil
}

func (s *UserService) GetMovieStats(userID string) (MovieStats, error) {
	var stats MovieStats

	totalViews, totalMinutes, err := s.movieRepo.GetMovieStatsCalculated(userID)
	if err != nil {
		return stats, err
	}

	stats.TotalWatched = totalViews
	stats.TotalRuntimeMinutes = totalMinutes

	return stats, nil
}

func (s *UserService) GetTVStats(userID string) (TVStats, error) {
	var stats TVStats

	totalEpisodes, totalMinutes, err := s.tvRepo.GetTVStatsCalculated(userID)
	if err != nil {
		return stats, err
	}

	stats.TotalEpisodesWatched = totalEpisodes
	stats.TotalRuntimeMinutes = totalMinutes

	return stats, nil
}
