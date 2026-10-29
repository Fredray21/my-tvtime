package user

import (
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"
	_ "time/tzdata" // L'image alpine n'embarque pas les fuseaux horaires

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tv"
)

// Au-delà de 16h de visionnage ou de 6 films sur une journée, c'est forcément un rattrapage d'historique
// (import, saisie en masse) : on garde ces vues dans les totaux mais on les exclut des records journaliers
const (
	backfillDayMinutes = 16 * 60
	backfillDayMovies  = 6
)

func isBackfillDay(day WrappedDay) bool {
	return day.Minutes > backfillDayMinutes || day.Movies > backfillDayMovies
}

// Nombre max d'appels TMDB en parallèle pour enrichir le récap
const wrappedTMDBWorkers = 20

type WrappedTitle struct {
	ID           int     `json:"id"`
	MediaType    string  `json:"media_type"`
	Title        string  `json:"title"`
	PosterPath   string  `json:"poster_path"`
	BackdropPath string  `json:"backdrop_path"`
	VoteAverage  float64 `json:"vote_average"`
	IsFavorite   bool    `json:"is_favorite"`
	RewatchCount int     `json:"rewatch_count,omitempty"`
	WatchedAt    string  `json:"watched_at,omitempty"`
}

type WrappedSeries struct {
	WrappedTitle
	Episodes int `json:"episodes"`
	Minutes  int `json:"minutes"`
}

type WrappedMonth struct {
	Month    int `json:"month"`
	Minutes  int `json:"minutes"`
	Movies   int `json:"movies"`
	Episodes int `json:"episodes"`
}

type WrappedGenre struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type WrappedPerson struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	ProfilePath string   `json:"profile_path"`
	Count       int      `json:"count"`
	Titles      []string `json:"titles"`
}

type WrappedDay struct {
	Date     string `json:"date"`
	Minutes  int    `json:"minutes"`
	Movies   int    `json:"movies"`
	Episodes int    `json:"episodes"`
}

type WrappedBinge struct {
	Date     string       `json:"date"`
	Episodes int          `json:"episodes"`
	Series   WrappedTitle `json:"series"`
}

type WrappedResponse struct {
	Year           int   `json:"year"`
	AvailableYears []int `json:"available_years"`

	TotalMinutes int `json:"total_minutes"`
	MovieMinutes int `json:"movie_minutes"`
	TVMinutes    int `json:"tv_minutes"`

	MoviesCount   int `json:"movies_count"`
	RewatchCount  int `json:"rewatch_count"`
	EpisodesCount int `json:"episodes_count"`
	SeriesCount   int `json:"series_count"`
	NewSeries     int `json:"new_series"`
	ActiveDays    int `json:"active_days"`

	Monthly  []WrappedMonth `json:"monthly"`
	Weekdays []int          `json:"weekdays"` // minutes par jour de la semaine, lundi en premier

	TopSeries       []WrappedSeries `json:"top_series"`
	HighlightMovies []WrappedTitle  `json:"highlight_movies"`
	TopGenres       []WrappedGenre  `json:"top_genres"`
	TopActors       []WrappedPerson `json:"top_actors"`
	FirstMovie      *WrappedTitle   `json:"first_movie"`
	LastMovie       *WrappedTitle   `json:"last_movie"`
	BusiestDay      *WrappedDay     `json:"busiest_day"`
	BiggestBinge    *WrappedBinge   `json:"biggest_binge"`
	LongestStreak   int             `json:"longest_streak"`
	BackfillDays    int             `json:"backfill_days"`
}

type wrappedCastMember struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	ProfilePath string `json:"profile_path"`
	Order       int    `json:"order"`
}

type wrappedTitleData struct {
	title   WrappedTitle
	genres  []string
	runtime int
	cast    []wrappedCastMember
}

// une vue (film ou épisode) datée, pour les stats temporelles
type wrappedEvent struct {
	at       time.Time
	minutes  int
	isMovie  bool
	seriesID int
}

func (s *UserService) GetWrapped(userID string, year int) (*WrappedResponse, error) {
	paris, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		return nil, err
	}

	years, err := s.repo.GetWrappedYears(userID)
	if err != nil {
		return nil, err
	}
	if year == 0 {
		year = time.Now().In(paris).Year()
		if len(years) > 0 && years[0] < year {
			year = years[0]
		}
	}

	start := time.Date(year, time.January, 1, 0, 0, 0, 0, paris)
	end := start.AddDate(1, 0, 0)

	movieRecords, err := s.repo.GetWrappedMovies(userID, start, end)
	if err != nil {
		return nil, err
	}
	episodeRecords, err := s.repo.GetWrappedEpisodes(userID, start, end)
	if err != nil {
		return nil, err
	}
	newSeries, err := s.repo.CountNewSeries(userID, start, end)
	if err != nil {
		return nil, err
	}

	// 1. Données TMDB (affiches, genres, durées, casting) récupérées en parallèle
	movieIDs := make([]int, 0, len(movieRecords))
	for _, rec := range movieRecords {
		movieIDs = append(movieIDs, rec.TMDBMovieID)
	}
	seriesIDs := make([]int, 0)
	seenSeries := make(map[int]bool)
	for _, rec := range episodeRecords {
		if !seenSeries[rec.TMDBSeriesID] {
			seenSeries[rec.TMDBSeriesID] = true
			seriesIDs = append(seriesIDs, rec.TMDBSeriesID)
		}
	}

	moviesData := s.fetchWrappedTitles("movie", movieIDs)
	seriesData := s.fetchWrappedTitles("tv", seriesIDs)

	response := &WrappedResponse{
		Year:            year,
		AvailableYears:  years,
		NewSeries:       newSeries,
		Monthly:         make([]WrappedMonth, 12),
		Weekdays:        make([]int, 7),
		TopSeries:       make([]WrappedSeries, 0),
		HighlightMovies: make([]WrappedTitle, 0),
		TopGenres:       make([]WrappedGenre, 0),
		TopActors:       make([]WrappedPerson, 0),
	}
	for i := range response.Monthly {
		response.Monthly[i].Month = i + 1
	}

	events := make([]wrappedEvent, 0, len(movieRecords)+len(episodeRecords))

	// 2. Films : première vue dans l'année, et/ou revisionnage dans l'année
	yearMovies := make([]WrappedTitle, 0)
	for _, rec := range movieRecords {
		// Si TMDB n'a pas répondu pour ce film, il reste compté (sans durée ni affiche) plutôt que de disparaître
		data, ok := moviesData[rec.TMDBMovieID]
		title := data.title
		title.IsFavorite = rec.IsFavorite
		title.RewatchCount = rec.RewatchCount

		inYear := func(t time.Time) bool { return !t.Before(start) && t.Before(end) }

		if inYear(rec.CreatedAt) {
			title.WatchedAt = rec.CreatedAt.In(paris).Format("2006-01-02")
			if ok {
				yearMovies = append(yearMovies, title)
			}
			response.MoviesCount++
			events = append(events, wrappedEvent{at: rec.CreatedAt, minutes: data.runtime, isMovie: true})
		}
		if rec.RewatchCount > 0 && inYear(rec.UpdatedAt) && !rec.UpdatedAt.Equal(rec.CreatedAt) {
			response.RewatchCount++
			events = append(events, wrappedEvent{at: rec.UpdatedAt, minutes: data.runtime, isMovie: true})
		}
	}

	// 3. Épisodes (durée TMDB de l'épisode, sinon durée moyenne de la série)
	seriesStats := make(map[int]*WrappedSeries)
	for _, rec := range episodeRecords {
		data, ok := seriesData[rec.TMDBSeriesID]
		minutes := rec.Runtime
		if minutes == 0 && ok {
			minutes = data.runtime
		}

		events = append(events, wrappedEvent{at: rec.FirstWatchedAt, minutes: minutes, seriesID: rec.TMDBSeriesID})
		response.EpisodesCount++

		if !ok {
			continue
		}
		stat, exists := seriesStats[rec.TMDBSeriesID]
		if !exists {
			stat = &WrappedSeries{WrappedTitle: data.title}
			seriesStats[rec.TMDBSeriesID] = stat
		}
		stat.Episodes++
		stat.Minutes += minutes
	}
	response.SeriesCount = len(seenSeries)

	// 4. Agrégats temporels
	type dayStat struct {
		WrappedDay
		episodesBySeries map[int]int
	}
	days := make(map[string]*dayStat)

	for _, ev := range events {
		local := ev.at.In(paris)
		month := &response.Monthly[local.Month()-1]
		month.Minutes += ev.minutes
		response.TotalMinutes += ev.minutes
		if ev.isMovie {
			month.Movies++
			response.MovieMinutes += ev.minutes
		} else {
			month.Episodes++
			response.TVMinutes += ev.minutes
		}

		key := local.Format("2006-01-02")
		day, exists := days[key]
		if !exists {
			day = &dayStat{WrappedDay: WrappedDay{Date: key}, episodesBySeries: make(map[int]int)}
			days[key] = day
		}
		day.Minutes += ev.minutes
		if ev.isMovie {
			day.Movies++
		} else {
			day.Episodes++
			day.episodesBySeries[ev.seriesID]++
		}
	}
	response.ActiveDays = len(days)

	// Records journaliers, sans les journées de rattrapage
	realDays := make([]string, 0, len(days))
	for key, day := range days {
		if isBackfillDay(day.WrappedDay) {
			response.BackfillDays++
			continue
		}
		realDays = append(realDays, key)

		date, _ := time.ParseInLocation("2006-01-02", key, paris)
		response.Weekdays[(int(date.Weekday())+6)%7] += day.Minutes

		if response.BusiestDay == nil || day.Minutes > response.BusiestDay.Minutes {
			busiest := day.WrappedDay
			response.BusiestDay = &busiest
		}
		for seriesID, count := range day.episodesBySeries {
			data, ok := seriesData[seriesID]
			if !ok || count < 2 {
				continue
			}
			if response.BiggestBinge == nil || count > response.BiggestBinge.Episodes {
				response.BiggestBinge = &WrappedBinge{Date: key, Episodes: count, Series: data.title}
			}
		}
	}
	response.LongestStreak = longestStreak(realDays)

	// 5. Classements
	for _, stat := range seriesStats {
		response.TopSeries = append(response.TopSeries, *stat)
	}
	sort.Slice(response.TopSeries, func(i, j int) bool {
		return response.TopSeries[i].Episodes > response.TopSeries[j].Episodes
	})
	if len(response.TopSeries) > 5 {
		response.TopSeries = response.TopSeries[:5]
	}

	if len(yearMovies) > 0 {
		first := yearMovies[0]
		last := yearMovies[len(yearMovies)-1]
		response.FirstMovie = &first
		response.LastMovie = &last
	}

	// Films marquants (pas de note perso) : coups de cœur, puis les plus revus, puis les mieux notés sur TMDB
	response.HighlightMovies = append(response.HighlightMovies, yearMovies...)
	sort.SliceStable(response.HighlightMovies, func(i, j int) bool {
		a, b := response.HighlightMovies[i], response.HighlightMovies[j]
		if a.IsFavorite != b.IsFavorite {
			return a.IsFavorite
		}
		if a.RewatchCount != b.RewatchCount {
			return a.RewatchCount > b.RewatchCount
		}
		return a.VoteAverage > b.VoteAverage
	})
	if len(response.HighlightMovies) > 10 {
		response.HighlightMovies = response.HighlightMovies[:10]
	}

	// Genres et acteurs : un titre (film ou série) compte pour 1
	genreCount := make(map[string]int)
	actors := make(map[int]*WrappedPerson)
	countTitle := func(data wrappedTitleData) {
		for _, genre := range data.genres {
			genreCount[genre]++
		}
		for _, member := range data.cast {
			if member.Order > 9 {
				continue
			}
			actor, exists := actors[member.ID]
			if !exists {
				actor = &WrappedPerson{ID: member.ID, Name: member.Name, ProfilePath: member.ProfilePath}
				actors[member.ID] = actor
			}
			actor.Count++
			actor.Titles = append(actor.Titles, data.title.Title)
		}
	}
	for _, title := range yearMovies {
		countTitle(moviesData[title.ID])
	}
	for id := range seriesStats {
		countTitle(seriesData[id])
	}

	for name, count := range genreCount {
		response.TopGenres = append(response.TopGenres, WrappedGenre{Name: name, Count: count})
	}
	sort.Slice(response.TopGenres, func(i, j int) bool {
		if response.TopGenres[i].Count != response.TopGenres[j].Count {
			return response.TopGenres[i].Count > response.TopGenres[j].Count
		}
		return response.TopGenres[i].Name < response.TopGenres[j].Name
	})
	if len(response.TopGenres) > 6 {
		response.TopGenres = response.TopGenres[:6]
	}

	for _, actor := range actors {
		if actor.Count >= 2 {
			response.TopActors = append(response.TopActors, *actor)
		}
	}
	sort.Slice(response.TopActors, func(i, j int) bool {
		if response.TopActors[i].Count != response.TopActors[j].Count {
			return response.TopActors[i].Count > response.TopActors[j].Count
		}
		return response.TopActors[i].Name < response.TopActors[j].Name
	})
	if len(response.TopActors) > 6 {
		response.TopActors = response.TopActors[:6]
	}
	for i := range response.TopActors {
		if len(response.TopActors[i].Titles) > 3 {
			response.TopActors[i].Titles = response.TopActors[i].Titles[:3]
		}
	}

	return response, nil
}

// fetchWrappedTitles récupère détails + casting TMDB pour une liste d'IDs, avec un nombre limité de requêtes simultanées
func (s *UserService) fetchWrappedTitles(mediaType string, ids []int) map[int]wrappedTitleData {
	results := make(map[int]wrappedTitleData, len(ids))
	var mu sync.Mutex
	var wg sync.WaitGroup
	jobs := make(chan int)

	for w := 0; w < wrappedTMDBWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range jobs {
				data, err := s.fetchWrappedTitle(mediaType, id)
				if err != nil {
					fmt.Printf("Wrapped : erreur TMDB pour %s %d: %v\n", mediaType, id, err)
					continue
				}
				mu.Lock()
				results[id] = data
				mu.Unlock()
			}
		}()
	}

	for _, id := range ids {
		jobs <- id
	}
	close(jobs)
	wg.Wait()

	return results
}

func (s *UserService) fetchWrappedTitle(mediaType string, id int) (wrappedTitleData, error) {
	var data wrappedTitleData

	if mediaType == "movie" {
		detailsBytes, err := s.tmdbClient.GetMovieDetails(id)
		if err != nil {
			return data, err
		}
		var details movie.TMDBMovieResult
		if err := json.Unmarshal(detailsBytes, &details); err != nil {
			return data, err
		}
		data.title = WrappedTitle{ID: details.ID, MediaType: "movie", Title: details.Title, PosterPath: details.PosterPath, BackdropPath: details.BackdropPath, VoteAverage: details.VoteAverage}
		data.runtime = details.Runtime
		for _, g := range details.Genres {
			data.genres = append(data.genres, g.Name)
		}
	} else {
		detailsBytes, err := s.tmdbClient.GetSeriesDetails(id)
		if err != nil {
			return data, err
		}
		var details tv.TMDBSeriesResult
		if err := json.Unmarshal(detailsBytes, &details); err != nil {
			return data, err
		}
		data.title = WrappedTitle{ID: details.ID, MediaType: "tv", Title: details.Name, PosterPath: details.PosterPath, BackdropPath: details.BackdropPath, VoteAverage: details.VoteAverage}
		// Durée moyenne d'un épisode : episode_run_time est souvent vide côté TMDB, on se rabat sur le dernier épisode diffusé
		if len(details.EpisodeRunTime) > 0 {
			data.runtime = details.EpisodeRunTime[0]
		} else if details.LastEpisodeToAir != nil {
			data.runtime = details.LastEpisodeToAir.Runtime
		}
		for _, g := range details.Genres {
			data.genres = append(data.genres, g.Name)
		}
	}

	// Le casting est un bonus : une erreur ici ne doit pas faire perdre le titre
	if creditsBytes, err := s.tmdbClient.GetCredits(id, mediaType); err == nil {
		var credits struct {
			Cast []wrappedCastMember `json:"cast"`
		}
		if json.Unmarshal(creditsBytes, &credits) == nil {
			data.cast = credits.Cast
		}
	}

	return data, nil
}

// longestStreak calcule le plus grand nombre de jours consécutifs avec au moins une vue
func longestStreak(dayKeys []string) int {
	if len(dayKeys) == 0 {
		return 0
	}
	sort.Strings(dayKeys)

	best, current := 1, 1
	prev, _ := time.Parse("2006-01-02", dayKeys[0])
	for _, key := range dayKeys[1:] {
		day, _ := time.Parse("2006-01-02", key)
		if day.Sub(prev) == 24*time.Hour {
			current++
		} else {
			current = 1
		}
		if current > best {
			best = current
		}
		prev = day
	}
	return best
}
