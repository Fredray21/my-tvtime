package person

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/tv"
)

// Genres TMDB à exclure de la filmographie (talk-shows, news) : ce sont des apparitions "dans son propre rôle"
var excludedTVGenres = map[int]bool{10767: true, 10763: true}

type TMDBPersonDetails struct {
	ID                 int      `json:"id"`
	Name               string   `json:"name"`
	Biography          string   `json:"biography"`
	Birthday           string   `json:"birthday"`
	Deathday           string   `json:"deathday"`
	PlaceOfBirth       string   `json:"place_of_birth"`
	ProfilePath        string   `json:"profile_path"`
	KnownForDepartment string   `json:"known_for_department"`
	AlsoKnownAs        []string `json:"also_known_as"`
	Homepage           string   `json:"homepage"`
	Gender             int      `json:"gender"`

	ExternalIDs struct {
		IMDbID      string `json:"imdb_id"`
		InstagramID string `json:"instagram_id"`
		TwitterID   string `json:"twitter_id"`
	} `json:"external_ids"`

	CombinedCredits struct {
		Cast []json.RawMessage `json:"cast"`
		Crew []json.RawMessage `json:"crew"`
	} `json:"combined_credits"`
}

// Infos propres à un crédit (rôle / poste), communes aux films et séries
type creditInfo struct {
	ID           int     `json:"id"`
	MediaType    string  `json:"media_type"`
	Character    string  `json:"character"`
	Job          string  `json:"job"`
	EpisodeCount int     `json:"episode_count"`
	Popularity   float64 `json:"popularity"`
	VoteCount    int     `json:"vote_count"`
	GenreIDs     []int   `json:"genre_ids"`
}

type MovieCredit struct {
	movie.MovieCustomResponse
	Character  string  `json:"character,omitempty"`
	Job        string  `json:"job,omitempty"`
	Popularity float64 `json:"popularity"`
	VoteCount  int     `json:"vote_count"`
}

type TVCredit struct {
	tv.SeriesCustomResponse
	Character    string `json:"character,omitempty"`
	Job          string `json:"job,omitempty"`
	EpisodeCount int    `json:"episode_count"`
	VoteCount    int    `json:"vote_count"`
}

type CreditGroup struct {
	Movies []MovieCredit `json:"movies"`
	TV     []TVCredit    `json:"tv"`
}

type PersonCustomResponse struct {
	ID                 int      `json:"id"`
	Name               string   `json:"name"`
	Biography          string   `json:"biography"`
	Birthday           string   `json:"birthday"`
	Deathday           string   `json:"deathday"`
	PlaceOfBirth       string   `json:"place_of_birth"`
	ProfilePath        string   `json:"profile_path"`
	KnownForDepartment string   `json:"known_for_department"`
	AlsoKnownAs        []string `json:"also_known_as"`
	Homepage           string   `json:"homepage"`
	Gender             int      `json:"gender"`
	IMDbID             string   `json:"imdb_id"`
	InstagramID        string   `json:"instagram_id"`

	Cast CreditGroup `json:"cast"`
	Crew CreditGroup `json:"crew"`
}

type PersonService struct {
	tmdbClient   *tmdb.Client
	movieService *movie.MovieService
	tvService    *tv.TVService
}

func NewService(tmdbClient *tmdb.Client, movieSvc *movie.MovieService, tvSvc *tv.TVService) *PersonService {
	return &PersonService{
		tmdbClient:   tmdbClient,
		movieService: movieSvc,
		tvService:    tvSvc,
	}
}

// GetPersonDetails renvoie la fiche d'une personne avec sa filmographie enrichie du statut de l'utilisateur
func (s *PersonService) GetPersonDetails(userID string, personID int) (*PersonCustomResponse, error) {
	tmdbBytes, err := s.tmdbClient.GetPersonDetails(personID, "fr-FR")
	if err != nil {
		return nil, err
	}

	var details TMDBPersonDetails
	if err := json.Unmarshal(tmdbBytes, &details); err != nil {
		return nil, fmt.Errorf("échec unmarshal person: %w", err)
	}

	// Beaucoup de biographies n'existent pas en français : on se rabat sur l'anglais
	if details.Biography == "" {
		if enBytes, err := s.tmdbClient.GetPersonDetails(personID, "en-US"); err == nil {
			var enDetails TMDBPersonDetails
			if json.Unmarshal(enBytes, &enDetails) == nil {
				details.Biography = enDetails.Biography
			}
		}
	}

	response := &PersonCustomResponse{
		ID:                 details.ID,
		Name:               details.Name,
		Biography:          details.Biography,
		Birthday:           details.Birthday,
		Deathday:           details.Deathday,
		PlaceOfBirth:       details.PlaceOfBirth,
		ProfilePath:        details.ProfilePath,
		KnownForDepartment: details.KnownForDepartment,
		AlsoKnownAs:        details.AlsoKnownAs,
		Homepage:           details.Homepage,
		Gender:             details.Gender,
		IMDbID:             details.ExternalIDs.IMDbID,
		InstagramID:        details.ExternalIDs.InstagramID,
		Cast:               buildCreditGroup(details.CombinedCredits.Cast),
		Crew:               buildCreditGroup(details.CombinedCredits.Crew),
	}

	if err := s.enrichCreditGroup(userID, &response.Cast); err != nil {
		return nil, err
	}
	if err := s.enrichCreditGroup(userID, &response.Crew); err != nil {
		return nil, err
	}

	return response, nil
}

// buildCreditGroup sépare films et séries et fusionne les doublons (plusieurs rôles / postes sur le même titre)
func buildCreditGroup(rawCredits []json.RawMessage) CreditGroup {
	group := CreditGroup{
		Movies: make([]MovieCredit, 0),
		TV:     make([]TVCredit, 0),
	}
	movieIndex := make(map[int]int)
	tvIndex := make(map[int]int)

	for _, raw := range rawCredits {
		var info creditInfo
		if err := json.Unmarshal(raw, &info); err != nil {
			continue
		}

		switch info.MediaType {
		case "movie":
			if idx, exists := movieIndex[info.ID]; exists {
				group.Movies[idx].Character = mergeLabel(group.Movies[idx].Character, info.Character)
				group.Movies[idx].Job = mergeLabel(group.Movies[idx].Job, info.Job)
				continue
			}

			var m movie.MovieCustomResponse
			json.Unmarshal(raw, &m)
			m.MediaType = "movie"

			movieIndex[info.ID] = len(group.Movies)
			group.Movies = append(group.Movies, MovieCredit{
				MovieCustomResponse: m,
				Character:           info.Character,
				Job:                 info.Job,
				Popularity:          info.Popularity,
				VoteCount:           info.VoteCount,
			})

		case "tv":
			if hasExcludedGenre(info.GenreIDs) {
				continue
			}

			if idx, exists := tvIndex[info.ID]; exists {
				group.TV[idx].Character = mergeLabel(group.TV[idx].Character, info.Character)
				group.TV[idx].Job = mergeLabel(group.TV[idx].Job, info.Job)
				group.TV[idx].EpisodeCount += info.EpisodeCount
				continue
			}

			var t tv.SeriesCustomResponse
			json.Unmarshal(raw, &t)
			t.MediaType = "tv"

			tvIndex[info.ID] = len(group.TV)
			group.TV = append(group.TV, TVCredit{
				SeriesCustomResponse: t,
				Character:            info.Character,
				Job:                  info.Job,
				EpisodeCount:         info.EpisodeCount,
				VoteCount:            info.VoteCount,
			})
		}
	}

	return group
}

// enrichCreditGroup applique le statut utilisateur (vu, watchlist, favori...) en une requête SQL par type
func (s *PersonService) enrichCreditGroup(userID string, group *CreditGroup) error {
	if len(group.Movies) > 0 {
		movies := make([]movie.MovieCustomResponse, len(group.Movies))
		for i, credit := range group.Movies {
			movies[i] = credit.MovieCustomResponse
		}

		enriched, err := s.movieService.EnrichWithUserStatus(userID, movies)
		if err != nil {
			return err
		}
		for i := range group.Movies {
			group.Movies[i].MovieCustomResponse = enriched[i]
		}
	}

	if len(group.TV) > 0 {
		series := make([]tv.SeriesCustomResponse, len(group.TV))
		for i, credit := range group.TV {
			series[i] = credit.SeriesCustomResponse
		}

		enriched, err := s.tvService.EnrichWithUserStatus(userID, series)
		if err != nil {
			return err
		}
		for i := range group.TV {
			group.TV[i].SeriesCustomResponse = enriched[i]
		}
	}

	return nil
}

func hasExcludedGenre(genreIDs []int) bool {
	for _, id := range genreIDs {
		if excludedTVGenres[id] {
			return true
		}
	}
	return false
}

// mergeLabel concatène deux rôles / postes sans doublon ("Réalisateur / Scénariste")
func mergeLabel(current string, addition string) string {
	if addition == "" || strings.Contains(current, addition) {
		return current
	}
	if current == "" {
		return addition
	}
	return current + " / " + addition
}
