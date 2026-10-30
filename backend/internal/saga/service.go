package saga

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// Nombre max d'appels TMDB en parallèle
const sagaTMDBWorkers = 20

type SagaPart struct {
	movie.MovieCustomResponse
	IsReleased bool `json:"is_released"`
}

type SagaResponse struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Overview     string `json:"overview"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`

	Parts         []SagaPart `json:"parts"` // ordre de sortie
	ReleasedCount int        `json:"released_count"`
	WatchedCount  int        `json:"watched_count"`
	UpcomingCount int        `json:"upcoming_count"`
	IsComplete    bool       `json:"is_complete"`
	NextMovie     *SagaPart  `json:"next_movie"` // 1er film sorti pas encore vu
}

// SagaSummary : version allégée pour la liste "Mes sagas"
type SagaSummary struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	PosterPath    string    `json:"poster_path"`
	BackdropPath  string    `json:"backdrop_path"`
	ReleasedCount int       `json:"released_count"`
	WatchedCount  int       `json:"watched_count"`
	UpcomingCount int       `json:"upcoming_count"`
	IsComplete    bool      `json:"is_complete"`
	NextMovie     *SagaPart `json:"next_movie"`
}

type Service struct {
	db           *sql.DB
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
}

func NewService(db *sql.DB, tmdbClient *tmdb.Client, movieSvc *movie.MovieService) *Service {
	return &Service{db: db, tmdbClient: tmdbClient, movieService: movieSvc}
}

// GetSaga renvoie une saga avec tous ses films dans l'ordre de sortie et la progression de l'utilisateur
func (s *Service) GetSaga(userID string, collectionID int) (*SagaResponse, error) {
	data, err := s.tmdbClient.GetCollection(collectionID)
	if err != nil {
		return nil, err
	}

	var collection struct {
		ID           int                         `json:"id"`
		Name         string                      `json:"name"`
		Overview     string                      `json:"overview"`
		PosterPath   string                      `json:"poster_path"`
		BackdropPath string                      `json:"backdrop_path"`
		Parts        []movie.MovieCustomResponse `json:"parts"`
	}
	if err := json.Unmarshal(data, &collection); err != nil {
		return nil, fmt.Errorf("échec unmarshal collection: %w", err)
	}

	// Ordre de sortie, les films sans date (annoncés) à la fin
	sort.SliceStable(collection.Parts, func(i, j int) bool {
		a, b := collection.Parts[i].ReleaseDate, collection.Parts[j].ReleaseDate
		if a == "" || b == "" {
			return a != ""
		}
		return a < b
	})

	parts := collection.Parts
	if len(parts) > 0 {
		for i := range parts {
			parts[i].MediaType = "movie"
		}
		parts, err = s.movieService.EnrichWithUserStatus(userID, parts)
		if err != nil {
			return nil, err
		}
	}

	today := time.Now().Format("2006-01-02")
	response := &SagaResponse{
		ID:           collection.ID,
		Name:         collection.Name,
		Overview:     collection.Overview,
		PosterPath:   collection.PosterPath,
		BackdropPath: collection.BackdropPath,
		Parts:        make([]SagaPart, 0, len(parts)),
	}

	for _, p := range parts {
		part := SagaPart{MovieCustomResponse: p, IsReleased: p.ReleaseDate != "" && p.ReleaseDate <= today}
		response.Parts = append(response.Parts, part)

		if !part.IsReleased {
			response.UpcomingCount++
			continue
		}
		response.ReleasedCount++
		if part.StatusLocal == "watched" {
			response.WatchedCount++
		} else if response.NextMovie == nil {
			next := part
			response.NextMovie = &next
		}
	}
	response.IsComplete = response.ReleasedCount > 0 && response.WatchedCount == response.ReleasedCount

	return response, nil
}

// GetUserSagas liste les sagas dont l'utilisateur a vu au moins un film
func (s *Service) GetUserSagas(userID string) ([]SagaSummary, error) {
	movieIDs, err := s.getWatchedMovieIDs(userID)
	if err != nil {
		return nil, err
	}

	// 1. Saga de chaque film vu (détails TMDB, en cache 24h)
	var mu sync.Mutex
	collectionIDs := make(map[int]bool)
	runParallel(movieIDs, func(movieID int) {
		movieBytes, err := s.tmdbClient.GetMovieDetails(movieID)
		if err != nil {
			return
		}
		var details struct {
			BelongsToCollection *movie.TMDBCollectionShort `json:"belongs_to_collection"`
		}
		if json.Unmarshal(movieBytes, &details) != nil || details.BelongsToCollection == nil {
			return
		}
		mu.Lock()
		collectionIDs[details.BelongsToCollection.ID] = true
		mu.Unlock()
	})

	// 2. Progression dans chaque saga
	ids := make([]int, 0, len(collectionIDs))
	for id := range collectionIDs {
		ids = append(ids, id)
	}

	sagas := make([]SagaSummary, 0, len(ids))
	runParallel(ids, func(collectionID int) {
		saga, err := s.GetSaga(userID, collectionID)
		if err != nil {
			fmt.Printf("Sagas : erreur pour la collection %d: %v\n", collectionID, err)
			return
		}
		// Une "saga" d'un seul film sorti n'a pas d'intérêt (ex: suite seulement annoncée)
		if saga.ReleasedCount < 2 {
			return
		}
		mu.Lock()
		sagas = append(sagas, SagaSummary{
			ID:            saga.ID,
			Name:          saga.Name,
			PosterPath:    saga.PosterPath,
			BackdropPath:  saga.BackdropPath,
			ReleasedCount: saga.ReleasedCount,
			WatchedCount:  saga.WatchedCount,
			UpcomingCount: saga.UpcomingCount,
			IsComplete:    saga.IsComplete,
			NextMovie:     saga.NextMovie,
		})
		mu.Unlock()
	})

	// En cours d'abord (les plus avancées en premier), puis les terminées
	sort.Slice(sagas, func(i, j int) bool {
		a, b := sagas[i], sagas[j]
		if a.IsComplete != b.IsComplete {
			return !a.IsComplete
		}
		progressA := float64(a.WatchedCount) / float64(a.ReleasedCount)
		progressB := float64(b.WatchedCount) / float64(b.ReleasedCount)
		if progressA != progressB {
			return progressA > progressB
		}
		return a.Name < b.Name
	})

	return sagas, nil
}

func (s *Service) getWatchedMovieIDs(userID string) ([]int, error) {
	rows, err := s.db.Query(`SELECT tmdb_movie_id FROM user_movies WHERE user_id = $1 AND status = 'watched'`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int, 0)
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// runParallel exécute fn sur chaque ID avec un nombre limité de goroutines
func runParallel(ids []int, fn func(id int)) {
	var wg sync.WaitGroup
	jobs := make(chan int)

	for w := 0; w < sagaTMDBWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range jobs {
				fn(id)
			}
		}()
	}

	for _, id := range ids {
		jobs <- id
	}
	close(jobs)
	wg.Wait()
}
