package tv

import (
	"encoding/json"
	"fmt"
	"sync"
)

func (s *TVService) EnrichSeriesRecords(userID string, records []SeriesRecord) ([]SeriesCustomResponse, error) {
	enrichedResults := make([]SeriesCustomResponse, len(records))
	var wg sync.WaitGroup

	for i, record := range records {
		wg.Add(1)
		go func(index int, rec SeriesRecord) {
			defer wg.Done()

			tmdbBytes, err := s.tmdbClient.GetSeriesDetails(rec.TMDBSeriesID)
			if err != nil {
				fmt.Printf("Erreur TMDB détails pour série %d: %v\n", rec.TMDBSeriesID, err)
				return
			}

			var tmdbSeries TMDBSeriesResult
			if err := json.Unmarshal(tmdbBytes, &tmdbSeries); err != nil {
				return
			}

			enrichedResults[index] = SeriesCustomResponse{
				TMDBSeriesResult: tmdbSeries,
				MediaType:        "tv",
				StatusLocal:      rec.Status,
				IsFavorite:       rec.IsFavorite,
				CreatedAt:        rec.CreatedAt,
				UpdatedAt:        rec.UpdatedAt,
			}
		}(i, record)
	}

	wg.Wait()

	// Nettoyage des résultats vides si TMDB a échoué sur une série
	validResults := make([]SeriesCustomResponse, 0)
	for _, res := range enrichedResults {
		if res.ID != 0 {
			validResults = append(validResults, res)
		}
	}

	return s.EnrichWithUserStatus(userID, validResults)
}

// EnrichWithUserStatus applique en une seule requête SQL les statuts locaux du batch
func (s *TVService) EnrichWithUserStatus(userID string, series []SeriesCustomResponse) ([]SeriesCustomResponse, error) {
	var tmdbIDs []int
	for _, m := range series {
		tmdbIDs = append(tmdbIDs, m.ID)
	}

	userStatuses, err := s.repo.GetUserStatusesForSeries(userID, tmdbIDs)
	if err != nil {
		return nil, err
	}

	for i := range series {
		status, exists := userStatuses[series[i].ID]
		if exists {
			series[i].StatusLocal = status.Status
			series[i].IsFavorite = status.IsFavorite
		} else {
			series[i].StatusLocal = "not_tracked"
			series[i].IsFavorite = false
		}
	}

	return series, nil
}
