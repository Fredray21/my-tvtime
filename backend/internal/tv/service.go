package tv

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// ==========================================
// STRUCTURES TMDB COMPLÈTES (FICHE DÉTAILS)
// ==========================================

type TMDBPerson struct {
	ID          int    `json:"id"`
	CreditID    string `json:"credit_id"`
	Name        string `json:"name"`
	Gender      int    `json:"gender"`
	ProfilePath string `json:"profile_path"`
}

type TMDBGenre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type TMDBEpisodeToAir struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Overview       string  `json:"overview"`
	VoteAverage    float64 `json:"vote_average"`
	VoteCount      int     `json:"vote_count"`
	AirDate        string  `json:"air_date"`
	EpisodeNumber  int     `json:"episode_number"`
	ProductionCode string  `json:"production_code"`
	Runtime        int     `json:"runtime"`
	SeasonNumber   int     `json:"season_number"`
	ShowID         int     `json:"show_id"`
	StillPath      string  `json:"still_path"`
}

type TMDBNetwork struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	LogoPath      string `json:"logo_path"`
	OriginCountry string `json:"origin_country"`
}

type TMDBProductionCompany struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	LogoPath      string `json:"logo_path"`
	OriginCountry string `json:"origin_country"`
}

type TMDBProductionCountry struct {
	Iso3166_1 string `json:"iso_3166_1"`
	Name      string `json:"name"`
}

type TMDBSeasonShort struct {
	AirDate      string  `json:"air_date"`
	EpisodeCount int     `json:"episode_count"`
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Overview     string  `json:"overview"`
	PosterPath   string  `json:"poster_path"`
	SeasonNumber int     `json:"season_number"`
	VoteAverage  float64 `json:"vote_average"`

	// custom data
	WatchedCount      int `json:"watched_count"`
	MaxEpisodeWatched int `json:"max_episode_watched"`
}

type TMDBSpokenLanguage struct {
	EnglishName string `json:"english_name"`
	Iso639_1    string `json:"iso_639_1"`
	Name        string `json:"name"`
}

// La structure principale "Série" qui englobe tout
type TMDBSeriesResult struct {
	Adult               bool                    `json:"adult"`
	BackdropPath        string                  `json:"backdrop_path"`
	CreatedBy           []TMDBPerson            `json:"created_by"`
	EpisodeRunTime      []int                   `json:"episode_run_time"`
	FirstAirDate        string                  `json:"first_air_date"`
	Genres              []TMDBGenre             `json:"genres"`
	Homepage            string                  `json:"homepage"`
	ID                  int                     `json:"id"`
	InProduction        bool                    `json:"in_production"`
	Languages           []string                `json:"languages"`
	LastAirDate         string                  `json:"last_air_date"`
	LastEpisodeToAir    *TMDBEpisodeToAir       `json:"last_episode_to_air"`
	Name                string                  `json:"name"`
	NextEpisodeToAir    *TMDBEpisodeToAir       `json:"next_episode_to_air"`
	Networks            []TMDBNetwork           `json:"networks"`
	NumberOfEpisodes    int                     `json:"number_of_episodes"`
	NumberOfSeasons     int                     `json:"number_of_seasons"`
	OriginCountry       []string                `json:"origin_country"`
	OriginalLanguage    string                  `json:"original_language"`
	OriginalName        string                  `json:"original_name"`
	Overview            string                  `json:"overview"`
	Popularity          float64                 `json:"popularity"`
	PosterPath          string                  `json:"poster_path"`
	ProductionCompanies []TMDBProductionCompany `json:"production_companies"`
	ProductionCountries []TMDBProductionCountry `json:"production_countries"`
	Seasons             []TMDBSeasonShort       `json:"seasons"`
	SpokenLanguages     []TMDBSpokenLanguage    `json:"spoken_languages"`
	Status              string                  `json:"status"`
	Tagline             string                  `json:"tagline"`
	Type                string                  `json:"type"`
	VoteAverage         float64                 `json:"vote_average"`
	VoteCount           int                     `json:"vote_count"`
}

// Réponse formatée pour ton frontend
type SeriesCustomResponse struct {
	TMDBSeriesResult
	StatusLocal string    `json:"status_local"` // 'watchlist', 'watching', 'finished', 'pending', 'not_tracked'
	IsFavorite  bool      `json:"is_favorite"`
	MediaType   string    `json:"media_type"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`

	NextSeasonNumber  int `json:"next_season_number"`
	NextEpisodeNumber int `json:"next_episode_number"`
}

// Structures pour les saisons et épisodes (Celles qu'il manquait !)
type TMDBEpisodeShort struct {
	ID            int     `json:"id"`
	Name          string  `json:"name"`
	Overview      string  `json:"overview"`
	EpisodeNumber int     `json:"episode_number"`
	SeasonNumber  int     `json:"season_number"`
	Runtime       int     `json:"runtime"`
	StillPath     string  `json:"still_path"`
	AirDate       string  `json:"air_date"`
	VoteAverage   float64 `json:"vote_average"`
}

type TMDBSeasonDetail struct {
	ID           int                `json:"id"`
	Name         string             `json:"name"`
	SeasonNumber int                `json:"season_number"`
	Overview     string             `json:"overview"`
	AirDate      string             `json:"air_date"`
	PosterPath   string             `json:"poster_path"`
	VoteAverage  float64            `json:"vote_average"`
	Episodes     []TMDBEpisodeShort `json:"episodes"`
}

// Les réponses customisées pour ton React
type EpisodeCustomResponse struct {
	TMDBEpisodeShort
	IsWatched    bool `json:"is_watched"`
	RewatchCount int  `json:"rewatch_count"`
}

type SeasonCustomResponse struct {
	TMDBSeasonDetail
	Episodes []EpisodeCustomResponse `json:"episodes"`
}

type TVService struct {
	repo       *Repository
	tmdbClient *tmdb.Client
}

func NewService(repo *Repository, tmdbClient *tmdb.Client) *TVService {
	return &TVService{
		repo:       repo,
		tmdbClient: tmdbClient,
	}
}

// fetchAndEnrichTMDBSeries gère la logique commune : appel TMDB, stats des saisons et calcul du prochain épisode.
func (s *TVService) fetchAndEnrichTMDBSeries(userID string, seriesID int) (TMDBSeriesResult, int, int, error) {
	var tmdbSeries TMDBSeriesResult

	tmdbBytes, err := s.tmdbClient.GetSeriesDetails(seriesID)
	if err != nil {
		return tmdbSeries, 0, 0, fmt.Errorf("erreur TMDB: %w", err)
	}

	if err := json.Unmarshal(tmdbBytes, &tmdbSeries); err != nil {
		return tmdbSeries, 0, 0, err
	}

	// Enrichissement avec les compteurs de visionnage par saison
	watchedCounts, _ := s.repo.GetWatchedCountBySeason(userID, seriesID)
	if watchedCounts != nil {
		for i, season := range tmdbSeries.Seasons {
			tmdbSeries.Seasons[i].WatchedCount = watchedCounts[season.SeasonNumber].WatchedCount
			tmdbSeries.Seasons[i].MaxEpisodeWatched = watchedCounts[season.SeasonNumber].MaxEpisodeWatched
		}
	}

	// Récupération du prochain épisode
	nextSeason, nextEpisode, err := s.repo.GetNextEpisodeForSeries(userID, seriesID)
	if err != nil {
		fmt.Printf("Erreur BDD prochain épisode pour série %d: %v\n", seriesID, err)
	}

	return tmdbSeries, nextSeason, nextEpisode, nil
}

// WatchEpisode gère le visionnage d'un épisode et met à jour automatiquement l'état de la série.
func (s *TVService) WatchEpisode(userID string, tmdbSeriesID int, seasonNumber int, episodeNumber int, watchedAt time.Time, serieIsFavorite bool) error {
	// On vérifie si la série existe déjà dans la table user_series
	record, err := s.repo.GetSeriesStatus(userID, tmdbSeriesID)
	if err != nil {
		return err
	}

	// Si la ligne n'existe pas, on l'initialise d'abord (ici en 'watching')
	// pour respecter la contrainte de clé étrangère (fk_user_series) de ta table user_episodes
	if record == nil {
		err = s.repo.SaveSeriesStatus(userID, tmdbSeriesID, "watching", serieIsFavorite, watchedAt, watchedAt)
		if err != nil {
			return err
		}
	}

	// Insère l'épisode ou incrémente le rewatch_count s'il existait déjà
	err = s.repo.SaveEpisode(userID, tmdbSeriesID, seasonNumber, episodeNumber, watchedAt)
	if err != nil {
		return err
	}

	go func() {
		tmdbBytes, err := s.tmdbClient.GetEpisodeDetails(tmdbSeriesID, seasonNumber, episodeNumber)
		if err == nil {
			var tmdbEp TMDBEpisodeShort
			if json.Unmarshal(tmdbBytes, &tmdbEp) == nil {
				_ = s.repo.SaveEpisodeMetadata(tmdbSeriesID, seasonNumber, episodeNumber, tmdbEp.Runtime, tmdbEp.AirDate)
			}
		}
	}()

	return s.SyncSeriesStatus(userID, tmdbSeriesID)
}

// SyncSeriesStatus compare les épisodes vus localement avec le total TMDB pour calculer le statut global.
func (s *TVService) SyncSeriesStatus(userID string, tmdbSeriesID int) error {
	// 1. Récupérer l'état actuel en base de données
	record, err := s.repo.GetSeriesStatus(userID, tmdbSeriesID)
	if err != nil {
		return err
	}
	if record == nil {
		return nil // L'utilisateur ne suit pas ou plus cette série
	}

	// 2. Récupérer la liste des épisodes uniques vus
	watchedEps, err := s.repo.GetWatchedEpisodesForSeries(userID, tmdbSeriesID)
	if err != nil {
		return err
	}
	totalWatched := len(watchedEps)

	// Trouver la date de la dernière activité (last_watched_at)
	lastActivity := record.UpdatedAt
	if len(watchedEps) > 0 {
		latest := watchedEps[0].LastWatchedAt
		for _, ep := range watchedEps {
			if ep.LastWatchedAt.After(latest) {
				latest = ep.LastWatchedAt
			}
		}
		lastActivity = latest
	}

	// 3. Récupérer le total à jour depuis TMDB via les bytes bruts
	tmdbBytes, err := s.tmdbClient.GetSeriesDetails(tmdbSeriesID)
	if err != nil {
		return fmt.Errorf("impossible de récupérer les détails TMDB pour la synchro: %w", err)
	}

	var tmdbSeries TMDBSeriesResult
	if err := json.Unmarshal(tmdbBytes, &tmdbSeries); err != nil {
		return fmt.Errorf("échec du décodage TMDB pour la synchro: %w", err)
	}
	totalTMDBEpisodes := tmdbSeries.NumberOfEpisodes

	// 4. MACHINE D'ÉTAT : Détermination du nouveau statut
	newStatus := record.Status

	if totalWatched == 0 {
		newStatus = "watchlist"
	} else if totalWatched < totalTMDBEpisodes {
		if record.Status == "finished" {
			// Le total d'épisodes TMDB a augmenté mais l'utilisateur n'a pas encore touché à la nouvelle saison
			newStatus = "pending"
		} else if record.Status == "watchlist" {
			newStatus = "watching"
		}

		// Si l'utilisateur était en 'pending' (nouvelle saison dispo) et qu'il vient de valider
		// un épisode, il reprend activement la série -> 'watching'
		if record.Status == "pending" {
			newStatus = "watching"
		}
	} else if totalWatched == totalTMDBEpisodes {
		newStatus = "finished"
	}

	// 5. Sauvegarde en BDD uniquement si le statut a changé
	if newStatus != record.Status {
		return s.repo.SaveSeriesStatus(userID, tmdbSeriesID, newStatus, record.IsFavorite, record.CreatedAt, lastActivity)
	}

	return nil
}

// GetSeriesDetailsForUser récupère la fiche complète d'une série et y injecte le statut local
func (s *TVService) GetSeriesDetailsForUser(userID string, seriesID int) (*SeriesCustomResponse, error) {
	tmdbSeries, nextSeason, nextEpisode, err := s.fetchAndEnrichTMDBSeries(userID, seriesID)
	if err != nil {
		return nil, err
	}

	customSeries := &SeriesCustomResponse{
		TMDBSeriesResult:  tmdbSeries,
		MediaType:         "tv",
		NextSeasonNumber:  nextSeason,
		NextEpisodeNumber: nextEpisode,
	}

	// Statut global de la série (spécifique à la fiche détail)
	record, err := s.repo.GetSeriesStatus(userID, seriesID)
	if err == nil && record != nil {
		customSeries.StatusLocal = record.Status
		customSeries.IsFavorite = record.IsFavorite
		customSeries.CreatedAt = record.CreatedAt
		customSeries.UpdatedAt = record.UpdatedAt
	} else {
		customSeries.StatusLocal = "not_tracked"
	}

	return customSeries, nil
}

// UpdateSeriesStatus permet de forcer un statut (ex: 'watchlist' ou 'favorite') sans regarder d'épisodes
func (s *TVService) UpdateSeriesStatus(userID string, tmdbSeriesID int, status string, isFavorite bool, createdAt time.Time, updatedAt time.Time) error {
	if status != "watchlist" && status != "watching" && status != "finished" && status != "pending" {
		return fmt.Errorf("statut invalide: %s", status)
	}

	record, err := s.repo.GetSeriesStatus(userID, tmdbSeriesID)
	if err == nil && record != nil {
		createdAt = record.CreatedAt
		updatedAt = record.UpdatedAt
	}

	go func() {
		tmdbBytes, err := s.tmdbClient.GetSeriesDetails(tmdbSeriesID)
		if err == nil {
			var tmdbSeries TMDBSeriesResult
			if json.Unmarshal(tmdbBytes, &tmdbSeries) == nil {
				if tmdbSeries.NextEpisodeToAir != nil {
					nextEp := tmdbSeries.NextEpisodeToAir
					_ = s.repo.SaveEpisodeMetadata(tmdbSeriesID, nextEp.SeasonNumber, nextEp.EpisodeNumber, nextEp.Runtime, nextEp.AirDate)
				}
			}
		}
	}()

	return s.repo.SaveSeriesStatus(userID, tmdbSeriesID, status, isFavorite, createdAt, updatedAt)
}

// RemoveSeries efface la série (la BDD gérera la suppression des épisodes grâce au ON DELETE CASCADE)
func (s *TVService) RemoveSeries(userID string, tmdbSeriesID int) error {
	return s.repo.DeleteSeries(userID, tmdbSeriesID)
}

// GetFavoritesForUser orchestre la récupération des séries favorites
func (s *TVService) GetFavoritesForUser(userID string) ([]SeriesCustomResponse, error) {
	records, err := s.repo.GetFavoriteSeriesRecords(userID)
	if err != nil {
		return nil, err
	}

	identifiers := make([]SeriesIdentifier, len(records))
	for i := range records {
		identifiers[i] = records[i]
	}

	return s.EnrichSeriesRecords(userID, identifiers)
}

// RemoveEpisode annule un visionnage et resynchronise le statut global de la série
func (s *TVService) RemoveEpisode(userID string, tmdbSeriesID int, seasonNumber int, episodeNumber int) error {
	err := s.repo.DeleteEpisode(userID, tmdbSeriesID, seasonNumber, episodeNumber)
	if err != nil {
		return err
	}

	// On recalcule le statut dynamique. Si on était 'finished', on risque de repasser en 'watching'
	return s.SyncSeriesStatus(userID, tmdbSeriesID)
}

// GetSimilarSeries récupère les recommandations TMDB et injecte les statuts locaux
func (s *TVService) GetSimilarSeries(userID string, seriesID int) ([]SeriesCustomResponse, error) {
	// Assure-toi que ton tmdbClient possède bien une méthode GetSimilarSeries (calquée sur GetSimilarMovie)
	tmdbBytes, err := s.tmdbClient.GetSimilarSeries(seriesID)
	if err != nil {
		return nil, err
	}

	var response struct {
		Results []SeriesCustomResponse `json:"results"`
	}
	if err := json.Unmarshal(tmdbBytes, &response); err != nil {
		return nil, err
	}

	return s.EnrichWithUserStatus(userID, response.Results)
}

// GetSeasonDetailsForUser fusionne la saison TMDB avec les épisodes vus par l'utilisateur
func (s *TVService) GetSeasonDetailsForUser(userID string, seriesID int, seasonNumber int) (*SeasonCustomResponse, error) {
	tmdbBytes, err := s.tmdbClient.GetSeasonDetails(seriesID, seasonNumber)
	if err != nil {
		return nil, fmt.Errorf("erreur TMDB saison: %w", err)
	}

	var tmdbSeason TMDBSeasonDetail
	if err := json.Unmarshal(tmdbBytes, &tmdbSeason); err != nil {
		return nil, fmt.Errorf("erreur décodage TMDB saison: %w", err)
	}

	go func() {
		for _, ep := range tmdbSeason.Episodes {
			_ = s.repo.SaveEpisodeMetadata(seriesID, ep.SeasonNumber, ep.EpisodeNumber, ep.Runtime, ep.AirDate)
		}
	}()

	watchedEps, err := s.repo.GetWatchedEpisodesForSeries(userID, seriesID)
	if err != nil {
		return nil, fmt.Errorf("erreur récupération épisodes vus: %w", err)
	}

	watchedMap := make(map[int]EpisodeRecord)
	for _, ep := range watchedEps {
		if ep.SeasonNumber == seasonNumber {
			watchedMap[ep.EpisodeNumber] = ep
		}
	}

	enrichedEpisodes := make([]EpisodeCustomResponse, 0)
	for _, tmdbEp := range tmdbSeason.Episodes {
		customEp := EpisodeCustomResponse{
			TMDBEpisodeShort: tmdbEp,
		}

		if record, exists := watchedMap[tmdbEp.EpisodeNumber]; exists {
			customEp.IsWatched = true
			customEp.RewatchCount = record.RewatchCount
		}

		enrichedEpisodes = append(enrichedEpisodes, customEp)
	}

	return &SeasonCustomResponse{
		TMDBSeasonDetail: tmdbSeason,
		Episodes:         enrichedEpisodes,
	}, nil
}

func (s *TVService) DecrementEpisode(userID string, tmdbSeriesID int, seasonNumber int, episodeNumber int) error {
	return s.repo.DecrementEpisodeRewatch(userID, tmdbSeriesID, seasonNumber, episodeNumber)
}

// GetUserSeriesOrderByStatus remplace GetWatchlistForUser pour gérer tous les états (watching, watchlist, finished, pending)
func (s *TVService) GetUserSeriesOrderByStatus(userID string, page int) ([]SeriesCustomResponse, error) {
	limit := 20
	records, err := s.repo.GetSeriesOrderByStatusRecords(userID, page, limit)
	if err != nil {
		return nil, err
	}

	identifiers := make([]SeriesIdentifier, len(records))
	for i := range records {
		identifiers[i] = records[i]
	}

	return s.EnrichSeriesRecords(userID, identifiers)
}

func (s *TVService) WatchAllEpisodesInSeason(userID string, tmdbSeriesID, seasonNum int) error {
	// On vérifie si la série existe déjà dans la table user_series
	record, err := s.repo.GetSeriesStatus(userID, tmdbSeriesID)
	if err != nil {
		return err
	}

	// Si la ligne n'existe pas, on l'initialise d'abord (ici en 'watching')
	// pour respecter la contrainte de clé étrangère (fk_user_series) de ta table user_episodes
	if record == nil {
		err = s.repo.SaveSeriesStatus(userID, tmdbSeriesID, "watching", false, time.Now(), time.Now())
		if err != nil {
			return err
		}
	}

	seasonData, err := s.tmdbClient.GetSeasonDetails(tmdbSeriesID, seasonNum)
	if err != nil {
		return err
	}

	var season TMDBSeasonDetail
	json.Unmarshal(seasonData, &season)

	for _, ep := range season.Episodes {
		_ = s.repo.SaveEpisode(userID, tmdbSeriesID, seasonNum, ep.EpisodeNumber, time.Now())
	}

	return s.SyncSeriesStatus(userID, tmdbSeriesID)
}

func (s *TVService) GetEpisodeDetails(tmdbSeriesID, seasonNum, epNum int) (*EpisodeCustomResponse, error) {
	// Appel direct à l'API TMDB pour UN SEUL épisode
	tmdbBytes, err := s.tmdbClient.GetEpisodeDetails(tmdbSeriesID, seasonNum, epNum)
	if err != nil {
		return nil, err
	}

	var tmdbEp TMDBEpisodeShort
	if err := json.Unmarshal(tmdbBytes, &tmdbEp); err != nil {
		return nil, err
	}

	return &EpisodeCustomResponse{
		TMDBEpisodeShort: tmdbEp,
		IsWatched:        true,
	}, nil
}

func (s *TVService) GetUpcomingSeries(userID string, page int) ([]SeriesCustomResponse, error) {
	limit := 20
	records, err := s.repo.GetUpcomingSeriesRecords(userID, page, limit)
	if err != nil {
		return nil, err
	}

	identifiers := make([]SeriesIdentifier, len(records))
	for i := range records {
		identifiers[i] = records[i]
	}

	return s.EnrichSeriesRecords(userID, identifiers)
}

func (s *TVService) GetSerieCredits(tmdbMovieID int) (map[string]interface{}, error) {
	data, err := s.tmdbClient.GetCredits(tmdbMovieID, "tv")
	if err != nil {
		return nil, err
	}

	var credits map[string]interface{}
	if err := json.Unmarshal(data, &credits); err != nil {
		return nil, err
	}
	return credits, nil
}
