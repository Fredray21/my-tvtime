package movie

import (
	"encoding/json"
	"fmt"
	"sync"
)

func (s *MovieService) EnrichMovieRecords(userID string, records []MovieRecord) ([]MovieCustomResponse, error) {
	enrichedResults := make([]MovieCustomResponse, len(records))
	var wg sync.WaitGroup

	for i, record := range records {
		wg.Add(1)
		// On lance une Goroutine (tâche parallèle) pour chaque film
		go func(index int, rec MovieRecord) {
			defer wg.Done()

			tmdbBytes, err := s.tmdbClient.GetMovieDetails(rec.TMDBMovieID)
			if err != nil {
				fmt.Printf("Erreur TMDB détails pour film %d: %v\n", rec.TMDBMovieID, err)
				return
			}

			var tmdbMovie TMDBMovieResult
			if err := json.Unmarshal(tmdbBytes, &tmdbMovie); err != nil {
				return
			}

			enrichedResults[index] = MovieCustomResponse{
				TMDBMovieResult: tmdbMovie,
				MediaType:       "movie",
			}
		}(i, record)
	}

	wg.Wait() // On attend que toutes les requêtes parallèles soient terminées

	// On nettoie les potentiels résultats vides (si TMDB a planté sur un film)
	validResults := make([]MovieCustomResponse, 0)
	for _, res := range enrichedResults {
		if res.ID != 0 {
			validResults = append(validResults, res)
		}
	}

	// 3. Enrichissement "Léger" : Application des statuts utilisateurs (SQL)
	return s.EnrichWithUserStatus(userID, validResults)
}

func (s *MovieService) EnrichWithUserStatus(userID string, movies []MovieCustomResponse) ([]MovieCustomResponse, error) {
	// 1. On récupère tous les IDs des films de la liste
	var tmdbIDs []int
	for _, m := range movies {
		tmdbIDs = append(tmdbIDs, m.ID)
	}

	// 2. On fait UNE SEULE requête SQL pour tout le batch (optimisation !)
	userStatuses, err := s.repo.GetUserStatusesForMovies(userID, tmdbIDs)
	if err != nil {
		return nil, err
	}

	// 3. On mappe les résultats
	for i := range movies {
		status, exists := userStatuses[movies[i].ID]
		if exists {
			movies[i].StatusLocal = status.Status
			movies[i].IsFavorite = status.IsFavorite
		} else {
			movies[i].StatusLocal = "not_tracked"
			movies[i].IsFavorite = false
		}
	}

	return movies, nil
}
