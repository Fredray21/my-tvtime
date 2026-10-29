package calendar

import (
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"
	_ "time/tzdata" // L'image alpine n'embarque pas les fuseaux horaires

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// Nombre max d'appels TMDB en parallèle
const calendarTMDBWorkers = 20

// Les épisodes / films sortis depuis moins de N jours restent affichés ("Sorti récemment")
const recentDays = 7

type CalendarItem struct {
	Type         string `json:"type"` // "episode" ou "movie"
	ID           int    `json:"id"`   // ID de la série ou du film
	Title        string `json:"title"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
	AirDate      string `json:"air_date"`

	// Épisodes
	SeasonNumber  int    `json:"season_number,omitempty"`
	EpisodeNumber int    `json:"episode_number,omitempty"`
	EpisodeName   string `json:"episode_name,omitempty"`
	StillPath     string `json:"still_path,omitempty"`
	Runtime       int    `json:"runtime,omitempty"`
	EpisodeType   string `json:"episode_type,omitempty"` // standard, finale, mid_season
	IsPremiere    bool   `json:"is_premiere,omitempty"`  // 1er épisode d'une saison
	IsWatched     bool   `json:"is_watched"`
	Network       string `json:"network,omitempty"`

	// Films
	ReleaseType string `json:"release_type,omitempty"` // theatrical, digital, physical, tv, premiere
	IsFrench    bool   `json:"is_french_date,omitempty"`
}

type CalendarDay struct {
	Date  string         `json:"date"`
	Items []CalendarItem `json:"items"`
}

type CalendarResponse struct {
	Today string        `json:"today"`
	Days  []CalendarDay `json:"days"`
}

type Service struct {
	repo       *Repository
	tmdbClient *tmdb.Client
}

func NewService(repo *Repository, tmdbClient *tmdb.Client) *Service {
	return &Service{repo: repo, tmdbClient: tmdbClient}
}

// Structures TMDB minimales (on a besoin de champs absents des modèles existants, ex: episode_type)
type tmdbSeries struct {
	ID               int    `json:"id"`
	Name             string `json:"name"`
	PosterPath       string `json:"poster_path"`
	BackdropPath     string `json:"backdrop_path"`
	NextEpisodeToAir *struct {
		SeasonNumber int `json:"season_number"`
	} `json:"next_episode_to_air"`
	LastEpisodeToAir *struct {
		SeasonNumber int    `json:"season_number"`
		AirDate      string `json:"air_date"`
	} `json:"last_episode_to_air"`
	Networks []struct {
		Name string `json:"name"`
	} `json:"networks"`
}

type tmdbSeasonEpisode struct {
	EpisodeNumber int    `json:"episode_number"`
	SeasonNumber  int    `json:"season_number"`
	Name          string `json:"name"`
	AirDate       string `json:"air_date"`
	Runtime       int    `json:"runtime"`
	StillPath     string `json:"still_path"`
	EpisodeType   string `json:"episode_type"`
}

type tmdbMovie struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
	ReleaseDate  string `json:"release_date"`
}

// GetCalendar renvoie, jour par jour, les épisodes des séries suivies et les sorties de la watchlist,
// de J-7 (rattrapage) à J+days. mediaType : "tv", "movie" ou "" (les deux)
func (s *Service) GetCalendar(userID string, mediaType string, days int) (*CalendarResponse, error) {
	paris, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		return nil, err
	}
	now := time.Now().In(paris)
	today := now.Format("2006-01-02")
	from := now.AddDate(0, 0, -recentDays).Format("2006-01-02")
	to := now.AddDate(0, 0, days).Format("2006-01-02")
	inWindow := func(date string) bool { return date != "" && date >= from && date <= to }

	items := make([]CalendarItem, 0)

	if mediaType != "movie" {
		episodes, err := s.getEpisodes(userID, inWindow)
		if err != nil {
			return nil, err
		}
		items = append(items, episodes...)
	}

	if mediaType != "tv" {
		movies, err := s.getMovies(userID, inWindow, from)
		if err != nil {
			return nil, err
		}
		items = append(items, movies...)
	}

	// Regroupement par jour
	byDate := make(map[string][]CalendarItem)
	for _, item := range items {
		byDate[item.AirDate] = append(byDate[item.AirDate], item)
	}

	response := &CalendarResponse{Today: today, Days: make([]CalendarDay, 0, len(byDate))}
	for date, dayItems := range byDate {
		sort.Slice(dayItems, func(i, j int) bool {
			a, b := dayItems[i], dayItems[j]
			if a.Type != b.Type {
				return a.Type == "movie"
			}
			if a.Title != b.Title {
				return a.Title < b.Title
			}
			if a.SeasonNumber != b.SeasonNumber {
				return a.SeasonNumber < b.SeasonNumber
			}
			return a.EpisodeNumber < b.EpisodeNumber
		})
		response.Days = append(response.Days, CalendarDay{Date: date, Items: dayItems})
	}
	sort.Slice(response.Days, func(i, j int) bool { return response.Days[i].Date < response.Days[j].Date })

	return response, nil
}

func (s *Service) getEpisodes(userID string, inWindow func(string) bool) ([]CalendarItem, error) {
	followed, err := s.repo.GetFollowedSeries(userID)
	if err != nil {
		return nil, err
	}

	seriesIDs := make([]int, 0, len(followed))
	for id := range followed {
		seriesIDs = append(seriesIDs, id)
	}

	watched, err := s.repo.GetWatchedEpisodes(userID, seriesIDs)
	if err != nil {
		return nil, err
	}

	var mu sync.Mutex
	items := make([]CalendarItem, 0)

	runParallel(seriesIDs, func(seriesID int) {
		seriesBytes, err := s.tmdbClient.GetSeriesDetails(seriesID)
		if err != nil {
			fmt.Printf("Calendrier : erreur TMDB série %d: %v\n", seriesID, err)
			return
		}
		var series tmdbSeries
		if json.Unmarshal(seriesBytes, &series) != nil {
			return
		}

		// Saisons à regarder : celle du prochain épisode (à venir) et celle du dernier diffusé (sorti récemment)
		seasons := make(map[int]bool)
		if series.NextEpisodeToAir != nil {
			seasons[series.NextEpisodeToAir.SeasonNumber] = true
		}
		if series.LastEpisodeToAir != nil && inWindow(series.LastEpisodeToAir.AirDate) {
			seasons[series.LastEpisodeToAir.SeasonNumber] = true
		}

		network := ""
		if len(series.Networks) > 0 {
			network = series.Networks[0].Name
		}

		for seasonNumber := range seasons {
			if seasonNumber == 0 {
				continue // On ignore les épisodes spéciaux
			}
			seasonBytes, err := s.tmdbClient.GetSeasonDetails(seriesID, seasonNumber)
			if err != nil {
				continue
			}
			var season struct {
				Episodes []tmdbSeasonEpisode `json:"episodes"`
			}
			if json.Unmarshal(seasonBytes, &season) != nil {
				continue
			}

			for _, ep := range season.Episodes {
				if !inWindow(ep.AirDate) {
					continue
				}
				item := CalendarItem{
					Type:          "episode",
					ID:            series.ID,
					Title:         series.Name,
					PosterPath:    series.PosterPath,
					BackdropPath:  series.BackdropPath,
					AirDate:       ep.AirDate,
					SeasonNumber:  ep.SeasonNumber,
					EpisodeNumber: ep.EpisodeNumber,
					EpisodeName:   ep.Name,
					StillPath:     ep.StillPath,
					Runtime:       ep.Runtime,
					EpisodeType:   ep.EpisodeType,
					IsPremiere:    ep.EpisodeNumber == 1,
					IsWatched:     watched[episodeKey{SeriesID: seriesID, Season: ep.SeasonNumber, Episode: ep.EpisodeNumber}],
					Network:       network,
				}
				mu.Lock()
				items = append(items, item)
				mu.Unlock()
			}
		}
	})

	return items, nil
}

func (s *Service) getMovies(userID string, inWindow func(string) bool, from string) ([]CalendarItem, error) {
	movieIDs, err := s.repo.GetWatchlistMovies(userID)
	if err != nil {
		return nil, err
	}

	var mu sync.Mutex
	items := make([]CalendarItem, 0)

	runParallel(movieIDs, func(movieID int) {
		movieBytes, err := s.tmdbClient.GetMovieDetails(movieID)
		if err != nil {
			fmt.Printf("Calendrier : erreur TMDB film %d: %v\n", movieID, err)
			return
		}
		var movie tmdbMovie
		if json.Unmarshal(movieBytes, &movie) != nil {
			return
		}

		// Film sorti depuis longtemps : inutile d'aller chercher ses dates de sortie détaillées
		if movie.ReleaseDate != "" && movie.ReleaseDate < from && !mayHaveLaterFrenchRelease(movie.ReleaseDate, from) {
			return
		}

		date, releaseType, isFrench := movie.ReleaseDate, "", false
		if releaseBytes, err := s.tmdbClient.GetMovieReleaseDates(movieID); err == nil {
			if frDate, frType, ok := pickFrenchRelease(releaseBytes); ok {
				date, releaseType, isFrench = frDate, frType, true
			}
		}

		if !inWindow(date) {
			return
		}

		mu.Lock()
		items = append(items, CalendarItem{
			Type:         "movie",
			ID:           movie.ID,
			Title:        movie.Title,
			PosterPath:   movie.PosterPath,
			BackdropPath: movie.BackdropPath,
			AirDate:      date,
			ReleaseType:  releaseType,
			IsFrench:     isFrench,
		})
		mu.Unlock()
	})

	return items, nil
}

// Une sortie française arrive rarement plus de 6 mois après la sortie mondiale
func mayHaveLaterFrenchRelease(releaseDate string, from string) bool {
	release, err := time.Parse("2006-01-02", releaseDate)
	if err != nil {
		return true
	}
	return release.AddDate(0, 6, 0).Format("2006-01-02") >= from
}

// Types TMDB : 1 avant-première, 2 cinéma (limité), 3 cinéma, 4 numérique, 5 physique, 6 TV
var releaseTypeNames = map[int]string{1: "premiere", 2: "theatrical", 3: "theatrical", 4: "digital", 5: "physical", 6: "tv"}

// pickFrenchRelease choisit la sortie française la plus pertinente : cinéma en priorité, sinon la plus tôt
func pickFrenchRelease(data []byte) (string, string, bool) {
	var payload struct {
		Results []struct {
			ISO31661     string `json:"iso_3166_1"`
			ReleaseDates []struct {
				ReleaseDate string `json:"release_date"`
				Type        int    `json:"type"`
			} `json:"release_dates"`
		} `json:"results"`
	}
	if json.Unmarshal(data, &payload) != nil {
		return "", "", false
	}

	for _, country := range payload.Results {
		if country.ISO31661 != "FR" {
			continue
		}

		bestDate, bestType, bestRank := "", 0, 99
		for _, rd := range country.ReleaseDates {
			if len(rd.ReleaseDate) < 10 || rd.Type == 1 {
				continue // On ignore les avant-premières (festivals)
			}
			date := rd.ReleaseDate[:10]
			rank := 2
			if rd.Type == 2 || rd.Type == 3 {
				rank = 1
			}
			if rank < bestRank || (rank == bestRank && date < bestDate) {
				bestDate, bestType, bestRank = date, rd.Type, rank
			}
		}
		if bestDate != "" {
			return bestDate, releaseTypeNames[bestType], true
		}
	}
	return "", "", false
}

// runParallel exécute fn sur chaque ID avec un nombre limité de goroutines
func runParallel(ids []int, fn func(id int)) {
	var wg sync.WaitGroup
	jobs := make(chan int)

	for w := 0; w < calendarTMDBWorkers; w++ {
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
