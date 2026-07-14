package importservice

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/tv"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

type TVTimeImporter struct {
	tmdbClient      *tmdb.Client
	dbClient        *http.Client
	tvdbToTmdbCache map[int]int
	TaskManager     *TaskManager
}

func NewTVTimeImporter(tmdbClient *tmdb.Client, tm *TaskManager) *TVTimeImporter {
	return &TVTimeImporter{
		tmdbClient:      tmdbClient,
		dbClient:        &http.Client{Timeout: 10 * time.Second},
		tvdbToTmdbCache: make(map[int]int),
		TaskManager:     tm,
	}
}

type TMDBFindResult struct {
	TVResults []struct {
		ID int `json:"id"`
	} `json:"tv_results"`
}

func (im *TVTimeImporter) GetTMDBIDFromTVDB(tvdbID int) (int, error) {
	if tmdbID, found := im.tvdbToTmdbCache[tvdbID]; found {
		return tmdbID, nil
	}
	tmdbBytes, err := im.tmdbClient.GetTMDBIDFromTVDB(tvdbID)
	if err != nil {
		return 0, err
	}
	var result TMDBFindResult
	if err := json.Unmarshal(tmdbBytes, &result); err != nil {
		return 0, err
	}
	if len(result.TVResults) == 0 {
		return 0, fmt.Errorf("non trouvé sur TMDB")
	}
	tmdbID := result.TVResults[0].ID
	im.tvdbToTmdbCache[tvdbID] = tmdbID
	return tmdbID, nil
}

func (im *TVTimeImporter) SearchMovieTMDB(title string, expectedDate string) (int, error) {
	// Parsing de la date pour le calcul de proximité
	var expectedDateTyped time.Time
	var hasValidDate bool
	parsedDate, err := time.Parse("2006-01-02", expectedDate)
	if err == nil {
		expectedDateTyped = parsedDate
		hasValidDate = true
	}

	doSearch := func(query string) (int, error) {
		cleanTitle := strings.TrimSpace(query)
		safeTitle := strings.ReplaceAll(cleanTitle, " ", "%20")
		safeTitle = strings.ReplaceAll(safeTitle, "&", "%26")

		tmdbBytes, err := im.tmdbClient.SearchMovie(safeTitle)
		if err != nil {
			return 0, err
		}

		var result struct {
			Results []struct {
				ID            int    `json:"id"`
				Title         string `json:"title"`
				OriginalTitle string `json:"original_title"`
				ReleaseDate   string `json:"release_date"`
			} `json:"results"`
		}
		if err := json.Unmarshal(tmdbBytes, &result); err != nil {
			return 0, err
		}

		if len(result.Results) == 0 {
			return 0, fmt.Errorf("non trouvé")
		}

		for _, res := range result.Results {
			if strings.EqualFold(res.OriginalTitle, cleanTitle) {
				if hasValidDate {
					// On dit à findClosestDate de filtrer spécifiquement sur OriginalTitle (true)
					return findClosestDate(result.Results, cleanTitle, true, expectedDateTyped), nil
				}
				return res.ID, nil
			}
		}

		for _, res := range result.Results {
			if strings.EqualFold(res.Title, cleanTitle) {
				if hasValidDate {
					return findClosestDate(result.Results, cleanTitle, false, expectedDateTyped), nil
				}
				return res.ID, nil
			}
		}

		// 🟢 PRIORITÉ 2 : Si aucun titre n'est identique, on prend le plus proche en date
		if hasValidDate {
			return findClosestDate(result.Results, "", false, expectedDateTyped), nil
		}

		// Défaut
		return result.Results[0].ID, nil
	}

	// Tentatives de recherche...
	id, err := doSearch(title)
	if err == nil {
		return id, nil
	}

	// Tentatives de secours (si le titre contient ":" ou "-")
	if strings.Contains(title, ":") {
		id, err := doSearch(strings.Split(title, ":")[0])
		if err == nil {
			return id, nil
		}
	}

	if strings.Contains(title, "-") {
		id, err := doSearch(strings.Split(title, "-")[0])
		if err == nil {
			return id, nil
		}
	}
	return 0, fmt.Errorf("film définitivement introuvable")
}

// 🟢 NOUVELLE MÉTHODE : Recherche intelligente pour les séries
func (im *TVTimeImporter) SearchTVShowTMDB(title string) (int, error) {
	cleanTitle := strings.TrimSpace(title)

	// TV Time ajoute souvent l'année entre parenthèses, ex: "Battlestar Galactica (2003)"
	// On la retire du titre pour la recherche TMDB
	if idx := strings.LastIndex(cleanTitle, "("); idx != -1 {
		if endIdx := strings.LastIndex(cleanTitle, ")"); endIdx > idx {
			possibleYear := cleanTitle[idx+1 : endIdx]
			if len(possibleYear) == 4 {
				cleanTitle = strings.TrimSpace(cleanTitle[:idx]) // Garde juste "Battlestar Galactica"
			}
		}
	}

	doSearch := func(query string) (int, error) {
		safeTitle := strings.ReplaceAll(query, " ", "%20")
		safeTitle = strings.ReplaceAll(safeTitle, "&", "%26")

		tmdbBytes, err := im.tmdbClient.SearchTVShow(safeTitle)
		if err != nil {
			return 0, err
		}

		// Pour les séries c'est "name" et "original_name"
		var result struct {
			Results []struct {
				ID           int    `json:"id"`
				Name         string `json:"name"`
				OriginalName string `json:"original_name"`
			} `json:"results"`
		}
		if err := json.Unmarshal(tmdbBytes, &result); err != nil {
			return 0, err
		}

		if len(result.Results) == 0 {
			return 0, fmt.Errorf("non trouvé")
		}

		// PRIORITÉ 1 : Nom ORIGINAL identique
		for _, res := range result.Results {
			if strings.EqualFold(res.OriginalName, query) {
				return res.ID, nil
			}
		}

		// PRIORITÉ 2 : Nom TRADUIT identique
		for _, res := range result.Results {
			if strings.EqualFold(res.Name, query) {
				return res.ID, nil
			}
		}

		// Défaut on prend le premier
		return result.Results[0].ID, nil
	}

	id, err := doSearch(cleanTitle)
	if err == nil {
		return id, nil
	}

	// Replis en cas de format "Série: Sous-titre"
	if strings.Contains(cleanTitle, ":") {
		id, err := doSearch(strings.Split(cleanTitle, ":")[0])
		if err == nil {
			return id, nil
		}
	}

	return 0, fmt.Errorf("série introuvable")
}

// Fonction utilitaire pour trouver la date la plus proche
func findClosestDate(results []struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	OriginalTitle string `json:"original_title"`
	ReleaseDate   string `json:"release_date"`
}, titleFilter string, isOriginalFilter bool, targetDate time.Time) int {
	bestID := results[0].ID
	var minDiff int64 = math.MaxInt64

	for _, res := range results {
		if titleFilter != "" {
			if isOriginalFilter && !strings.EqualFold(res.OriginalTitle, titleFilter) {
				continue
			}
			if !isOriginalFilter && !strings.EqualFold(res.Title, titleFilter) {
				continue
			}
		}

		if res.ReleaseDate == "" {
			continue
		}

		resDate, err := time.Parse("2006-01-02", res.ReleaseDate)
		if err != nil {
			continue
		}

		diff := int64(math.Abs(targetDate.Sub(resDate).Hours() / 24))
		if diff < minDiff {
			minDiff = diff
			bestID = res.ID
		}
	}
	return bestID
}

// ---------------------------------------------------------------------------
// 1. PHASE D'ANALYSE (Lecture des CSV depuis le ZIP)
// ---------------------------------------------------------------------------
func (im *TVTimeImporter) StartAsyncAnalysis(taskID string, zipBytes []byte) {
	status, exists := im.TaskManager.Get(taskID)
	if !exists {
		return
	}

	readerAt := bytes.NewReader(zipBytes)
	r, err := zip.NewReader(readerAt, int64(len(zipBytes)))
	if err != nil {
		status.State = "failed"
		status.Error = "Fichier ZIP corrompu ou illisible"
		im.TaskManager.Set(taskID, status)
		return
	}

	var followedFile *zip.File
	var trackingSeriesFile *zip.File
	var trackingMoviesFile *zip.File

	// Identification des fichiers
	for _, f := range r.File {
		// 🟢 CHANGEMENT ICI : On utilise user_tv_show_data.csv
		if strings.HasSuffix(f.Name, "user_tv_show_data.csv") {
			followedFile = f
		} else if strings.HasSuffix(f.Name, "tracking-prod-records-v2.csv") {
			trackingSeriesFile = f
		} else if strings.HasSuffix(f.Name, "tracking-prod-records.csv") {
			trackingMoviesFile = f
		}
	}

	analysis := &ImportAnalysisResponse{}
	tvShowsMap := make(map[int]*TVImportItem)

	// 1. Chargement des séries explicitement suivies (Watchlist potentielle)
	if followedFile != nil {
		if rc, err := followedFile.Open(); err == nil {
			im.parseWatchlist(rc, tvShowsMap, analysis)
			rc.Close()
		}
	}

	// 2. Analyse des vrais épisodes vus (tracking v2)
	if trackingSeriesFile != nil {
		if rc, err := trackingSeriesFile.Open(); err == nil {
			im.analyzeSeriesWithProgress(taskID, rc, tvShowsMap, analysis)
			rc.Close()
		}
	}

	// 3. Analyse des films (tracking prod)
	if trackingMoviesFile != nil {
		if rc, err := trackingMoviesFile.Open(); err == nil {
			im.analyzeMoviesWithProgress(taskID, rc, analysis)
			rc.Close()
		}
	}

	// Terminer la tâche
	status, _ = im.TaskManager.Get(taskID)
	status.State = "completed"
	status.PercentTV = 100
	status.PercentMovies = 100
	status.Progress = "Traitement terminé. Prêt à l'importation !"
	status.Result = analysis
	im.TaskManager.Set(taskID, status)
}

func (im *TVTimeImporter) parseWatchlist(r io.Reader, tvShowsMap map[int]*TVImportItem, analysis *ImportAnalysisResponse) {
	reader := csv.NewReader(r)
	header, err := reader.Read()
	if err != nil {
		return
	}
	colMap := make(map[string]int)
	for i, col := range header {
		colMap[col] = i
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		if idxID, ok := colMap["tv_show_id"]; ok && record[idxID] != "" {
			tvdbID, _ := strconv.Atoi(record[idxID])

			seriesName := ""
			if idxName, ok := colMap["tv_show_name"]; ok && record[idxName] != "" {
				seriesName = record[idxName]
			}

			if seriesName == "" {
				seriesName = "Série Inconnue"
			}

			isFavorited := false
			if idxFav, ok := colMap["is_favorited"]; ok && record[idxFav] == "1" {
				isFavorited = true
			}

			tmdbID, err := im.GetTMDBIDFromTVDB(tvdbID)

			if err != nil {
				if seriesName != "" {
					tmdbID, err = im.SearchTVShowTMDB(seriesName)
				}

				// Si ça échoue encore, on log l'erreur pour la voir dans "Non trouvés"
				if err != nil {
					errorMessage := fmt.Sprintf("%s (Erreur TVDB ID: %d)", seriesName, tvdbID)
					analysis.TV.NotFound = append(analysis.TV.NotFound, errorMessage)
					continue
				}
			}

			// On l'ajoute en tant que série "Watchlist" par défaut
			tvShowsMap[tmdbID] = &TVImportItem{
				Title:      seriesName,
				TMDBID:     tmdbID,
				Episodes:   []WatchedEpisode{},
				Watchlist:  true,
				IsFavorite: isFavorited,
			}
		}
	}
}

func (im *TVTimeImporter) analyzeSeriesWithProgress(taskID string, r io.Reader, tvShowsMap map[int]*TVImportItem, analysis *ImportAnalysisResponse) {
	status, _ := im.TaskManager.Get(taskID)
	reader := csv.NewReader(r)
	records, err := reader.ReadAll()
	if err != nil || len(records) <= 1 {
		return
	}

	header := records[0]
	colMap := make(map[string]int)
	for i, col := range header {
		colMap[col] = i
	}

	failedSeries := make(map[string]bool)
	totalLines := len(records) - 1

	for i := 1; i < len(records); i++ {
		record := records[i]

		// Met à jour la barre de progression TV (0 -> 100%)
		if i%10 == 0 || i == totalLines {
			status.PercentTV = int((float64(i) / float64(totalLines)) * 100)
			status.Progress = fmt.Sprintf("Recherche des séries (%d/%d)...", i, totalLines)
			im.TaskManager.Set(taskID, status)
		}

		if idxID, ok := colMap["s_id"]; !ok || record[idxID] == "" {
			continue
		}

		tvdbIDStr := record[colMap["s_id"]]
		seriesName := ""
		if idxName, ok := colMap["series_name"]; ok {
			seriesName = record[idxName]
		}

		// SÉCURITÉ : Vérifie la validité des numéros de saison et d'épisode
		seasonStr := ""
		episodeStr := ""
		if idxS, ok := colMap["season_number"]; ok {
			seasonStr = record[idxS]
		}
		if idxE, ok := colMap["episode_number"]; ok {
			episodeStr = record[idxE]
		}

		// Si l'une des valeurs est vide ou vaut "0", ce n'est PAS un visionnage valide.
		if seasonStr == "" || episodeStr == "" || seasonStr == "0" || episodeStr == "0" {
			continue
		}

		tvdbID, _ := strconv.Atoi(tvdbIDStr)
		season, _ := strconv.Atoi(seasonStr)
		episode, _ := strconv.Atoi(episodeStr)

		// Récupération du rewatch_count depuis l'export
		rewatchCount := 0
		if idxRW, ok := colMap["rewatch_count"]; ok && record[idxRW] != "" {
			if val, err := strconv.ParseFloat(record[idxRW], 64); err == nil {
				rewatchCount = int(val)
			}
		}

		createdAtStr := record[colMap["created_at"]]
		watchedAt, err := time.Parse("2006-01-02 15:04:05", createdAtStr)
		if err != nil {
			watchedAt = time.Now()
		}

		// Si on a déjà determiné que la série est introuvable, on passe
		if failedSeries[seriesName] {
			continue
		}

		// 1. TENTATIVE N°1 : Recherche précise par l'ID TVDB
		tmdbID, err := im.GetTMDBIDFromTVDB(tvdbID)

		// 2. 🟢 TENTATIVE N°2 (REPLI) : Si l'ID TVDB échoue, on cherche par le nom
		if err != nil {
			if seriesName != "" {
				tmdbID, err = im.SearchTVShowTMDB(seriesName)
			}

			// Si la recherche par nom échoue aussi, c'est définitivement mort
			if err != nil {
				failedSeries[seriesName] = true
				continue
			}
		}

		item, exists := tvShowsMap[tmdbID]
		if !exists {
			item = &TVImportItem{
				Title:      seriesName,
				TMDBID:     tmdbID,
				Episodes:   []WatchedEpisode{},
				Watchlist:  false,
				IsFavorite: false, // Initialisé à false par défaut pour les épisodes vus
			}
			tvShowsMap[tmdbID] = item
		}

		// Un épisode valide a été trouvé, on enlève le statut "uniquement Watchlist"
		item.Watchlist = false

		// Déduplication & Addition des rewatchs
		isDuplicate := false
		for idx, ep := range item.Episodes {
			if ep.Season == season && ep.Episode == episode {
				// Si doublon trouvé, on additionne le rewatch count global + 1 pour l'action dupliquée
				item.Episodes[idx].RewatchCount += rewatchCount + 1
				isDuplicate = true
				break
			}
		}

		if !isDuplicate {
			item.Episodes = append(item.Episodes, WatchedEpisode{
				Season:       season,
				Episode:      episode,
				RewatchCount: rewatchCount,
				WatchedAt:    watchedAt,
			})
		}
	}

	for _, item := range tvShowsMap {
		analysis.TV.ToImport = append(analysis.TV.ToImport, *item)
	}
	for name := range failedSeries {
		if name == "" || name == "Série Inconnue" {
			continue // On ignore les séries fantômes sans nom
		}

		isDuplicate := false
		for _, existing := range analysis.TV.NotFound {
			// Si "Vlog d'août" est déjà le début de "Vlog d'août (Erreur TVDB...)"
			if strings.HasPrefix(existing, name) {
				isDuplicate = true
				break
			}
		}

		if !isDuplicate {
			analysis.TV.NotFound = append(analysis.TV.NotFound, name)
		}
	}
}

func (im *TVTimeImporter) analyzeMoviesWithProgress(taskID string, r io.Reader, analysis *ImportAnalysisResponse) {
	status, _ := im.TaskManager.Get(taskID)
	reader := csv.NewReader(r)
	records, err := reader.ReadAll()
	if err != nil || len(records) <= 1 {
		return
	}

	header := records[0]
	colMap := make(map[string]int)
	for i, col := range header {
		colMap[col] = i
	}

	//Ajout de MovieName dans la structure puisqu'on va changer la clé de la map
	type localMovieData struct {
		MovieName    string
		WatchedAt    time.Time
		IsWatched    bool
		RewatchCount int
		ReleaseDate  string
	}
	localMovies := make(map[string]*localMovieData)

	for i := 1; i < len(records); i++ {
		record := records[i]

		if idxType, ok := colMap["entity_type"]; ok && record[idxType] != "movie" {
			continue
		}

		movieName := ""
		if idxName, ok := colMap["movie_name"]; ok {
			movieName = record[idxName]
		}

		if movieName == "" {
			if idxAlpha, ok := colMap["alpha_range_key"]; ok && record[idxAlpha] != "" {
				alphaKey := record[idxAlpha]
				parts := strings.Split(alphaKey, "-alpha-")
				if len(parts) == 2 {
					// "the-emoji-movie" -> "the emoji movie"
					movieName = strings.ReplaceAll(parts[1], "-", " ")
					// Application du bon Title Case
					caser := cases.Title(language.Und)
					movieName = caser.String(movieName)
				}
			}
		}

		if movieName == "" {
			continue
		}

		rowType := ""
		if idxT, ok := colMap["type"]; ok {
			rowType = strings.ToLower(record[idxT])
		}

		rewatchCount := 0
		if idxRW, ok := colMap["rewatch_count"]; ok && record[idxRW] != "" {
			if val, err := strconv.Atoi(record[idxRW]); err == nil {
				rewatchCount = val
			}
		}

		isWatchedAction := (rowType == "watch" || rowType == "rewatch" || (rowType == "rewatch_count" && rewatchCount > 0))

		createdAtStr := record[colMap["created_at"]]
		actionDate, err := time.Parse("2006-01-02 15:04:05", createdAtStr)
		if err != nil {
			actionDate = time.Now()
		}

		releaseDate := ""
		if idxRD, ok := colMap["release_date"]; ok && len(record[idxRD]) >= 10 {
			releaseDate = record[idxRD][:10] // "2022-11-01"
		}

		//CRÉATION DE LA CLÉ UNIQUE (Nom du film + Année)
		cacheKey := movieName + "|" + releaseDate

		// On vérifie avec la NOUVELLE clé
		if existing, exists := localMovies[cacheKey]; exists {
			if rewatchCount > existing.RewatchCount {
				existing.RewatchCount = rewatchCount
			}
			if isWatchedAction {
				if !existing.IsWatched {
					existing.IsWatched = true
					existing.WatchedAt = actionDate
				} else if actionDate.Before(existing.WatchedAt) {
					existing.WatchedAt = actionDate
				}
			}
			if existing.ReleaseDate == "" && releaseDate != "" {
				existing.ReleaseDate = releaseDate
			}
		} else {
			// Si le film (et son année précise) n'a pas encore été vu, on l'ajoute
			localMovies[cacheKey] = &localMovieData{
				MovieName:    movieName, // On mémorise le vrai nom pour la recherche
				WatchedAt:    actionDate,
				IsWatched:    isWatchedAction,
				RewatchCount: rewatchCount,
				ReleaseDate:  releaseDate,
			}
		}
	}

	failedMovies := make(map[string]bool)
	uniqueMovies := make(map[int]*MovieImportItem)

	totalUniqueMovies := len(localMovies)
	currentIndex := 0

	//On boucle sur les données, la clé ("The Lion King|1994") ne sert plus, on utilise data.MovieName
	for _, data := range localMovies {
		currentIndex++

		if currentIndex%5 == 0 || currentIndex == totalUniqueMovies {
			status.PercentMovies = int((float64(currentIndex) / float64(totalUniqueMovies)) * 100)
			status.Progress = fmt.Sprintf("Recherche des films (%d/%d)...", currentIndex, totalUniqueMovies)
			im.TaskManager.Set(taskID, status)
		}

		//On passe le vrai nom ET l'année !
		tmdbID, err := im.SearchMovieTMDB(data.MovieName, data.ReleaseDate)
		if err != nil {
			failedMovies[data.MovieName] = true
			continue
		}

		// La déduplication finale par ID TMDB (Sécurité si des titres étrangers pointent vers le même film)
		if existing, exists := uniqueMovies[tmdbID]; exists {
			if data.RewatchCount > existing.RewatchCount {
				existing.RewatchCount = data.RewatchCount
			}
			if data.IsWatched {
				if existing.WatchlistOnly {
					existing.WatchlistOnly = false
					existing.WatchedAt = data.WatchedAt
				} else if data.WatchedAt.Before(existing.WatchedAt) {
					existing.WatchedAt = data.WatchedAt
				}
			}
		} else {
			uniqueMovies[tmdbID] = &MovieImportItem{
				Title:         data.MovieName,
				TMDBID:        tmdbID,
				WatchedAt:     data.WatchedAt,
				WatchlistOnly: !data.IsWatched,
				RewatchCount:  data.RewatchCount,
			}
		}

		time.Sleep(30 * time.Millisecond)
	}

	for _, item := range uniqueMovies {
		analysis.Movies.ToImport = append(analysis.Movies.ToImport, *item)
	}
	for name := range failedMovies {
		analysis.Movies.NotFound = append(analysis.Movies.NotFound, name)
	}
}

// ---------------------------------------------------------------------------
// 2. PHASE D'INSERTION BDD (Appelée lors de la confirmation par le frontend)
// ---------------------------------------------------------------------------
func (im *TVTimeImporter) ExecuteDatabaseImport(taskID string, userID string, data ImportAnalysisResponse, tvService *tv.TVService, movieService *movie.MovieService) {
	status, exists := im.TaskManager.Get(taskID)
	if !exists {
		return
	}

	totalTV := len(data.TV.ToImport)
	totalMovies := len(data.Movies.ToImport)

	// 1. ÉCRITURE DES SÉRIES & ÉPISODES
	for i, tvItem := range data.TV.ToImport {
		if totalTV > 0 {
			status.PercentTV = int((float64(i) / float64(totalTV)) * 100)
			status.Progress = fmt.Sprintf("Enregistrement des séries : %d/%d...", i, totalTV)
			im.TaskManager.Set(taskID, status)
		}

		if tvItem.Watchlist {
			_ = tvService.UpdateSeriesStatus(userID, tvItem.TMDBID, "watchlist", tvItem.IsFavorite)
		} else {
			_ = tvService.UpdateSeriesStatus(userID, tvItem.TMDBID, "watchlist", tvItem.IsFavorite)

			// Épisodes vus
			for _, ep := range tvItem.Episodes {
				_ = tvService.WatchEpisode(userID, tvItem.TMDBID, ep.Season, ep.Episode, ep.WatchedAt, tvItem.IsFavorite)

				// S'il y a des Rewatch Count historiques
				for r := 0; r < ep.RewatchCount; r++ {
					_ = tvService.WatchEpisode(userID, tvItem.TMDBID, ep.Season, ep.Episode, ep.WatchedAt, tvItem.IsFavorite)
				}
			}
		}
	}
	status.PercentTV = 100
	im.TaskManager.Set(taskID, status)

	// 2. ÉCRITURE DES FILMS
	for i, movieItem := range data.Movies.ToImport {
		if totalMovies > 0 {
			status.PercentMovies = int((float64(i) / float64(totalMovies)) * 100)
			status.Progress = fmt.Sprintf("Enregistrement des films : %d/%d...", i, totalMovies)
			im.TaskManager.Set(taskID, status)
		}

		if movieItem.WatchlistOnly {
			// Film simplement mis de côté (IsFavorite = false, RewatchCount = 0)
			_ = movieService.UpdateMovieStatus(userID, movieItem.TMDBID, "watchlist", false, 0, movieItem.WatchedAt)
		} else {
			// Film vu (IsFavorite = false, RewatchCount = 0)
			_ = movieService.UpdateMovieStatus(userID, movieItem.TMDBID, "watched", false, movieItem.RewatchCount, movieItem.WatchedAt)
		}
	}

	status, _ = im.TaskManager.Get(taskID)
	status.State = "completed"
	status.PercentMovies = 100
	status.Progress = "Importation historique terminée avec succès !"
	im.TaskManager.Set(taskID, status)
}
