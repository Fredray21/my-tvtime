package tv

import (
	"fmt"
	"sync"
)

func (s *TVService) EnrichSeriesRecords(userID string, records []SeriesIdentifier) ([]SeriesCustomResponse, error) {
	enrichedResults := make([]SeriesCustomResponse, len(records))
	var wg sync.WaitGroup

	for i, record := range records {
		wg.Add(1)
		go func(index int, rec SeriesIdentifier) {
			defer wg.Done()

			tmdbSeries, nextSeason, nextEpisode, err := s.fetchAndEnrichTMDBSeries(userID, rec.GetTMDBID())
			if err != nil {
				fmt.Printf("Erreur pour série %d: %v\n", rec.GetTMDBID(), err)
				return
			}

			enrichedResults[index] = SeriesCustomResponse{
				TMDBSeriesResult:  tmdbSeries,
				MediaType:         "tv",
				StatusLocal:       rec.GetStatus(),
				IsFavorite:        rec.GetIsFavorite(),
				CreatedAt:         rec.GetCreatedAt(),
				UpdatedAt:         rec.GetUpdatedAt(),
				NextSeasonNumber:  nextSeason,
				NextEpisodeNumber: nextEpisode,
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
