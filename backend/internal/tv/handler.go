package tv

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *TVService
}

func NewHandler(s *TVService) *Handler {
	return &Handler{service: s}
}

// 1. POST /api/tv/watch
// Structure pour décoder le JSON envoyé par le bouton "Vu" du frontend
type WatchEpisodePayload struct {
	TMDBSeriesID  int `json:"tmdb_id"`
	SeasonNumber  int `json:"season_number"`
	EpisodeNumber int `json:"episode_number"`
}

type UpdateSeriesStatusPayload struct {
	TMDBSeriesID int    `json:"tmdb_id"`
	StatusLocal  string `json:"status_local"` // 'watchlist', 'watching', 'finished', etc.
	IsFavorite   bool   `json:"is_favorite"`
}

func (h *Handler) HandlerWatchEpisode(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	var req WatchEpisodePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide ou champs obligatoires manquants"})
		return
	}

	err := h.service.WatchEpisode(userID.(string), req.TMDBSeriesID, req.SeasonNumber, req.EpisodeNumber, time.Now(), false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Épisode marqué comme vu avec succès"})
}

// 2. GET /api/tv/watchlist?page=1
func (h *Handler) HandlerGetWatchlist(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	// Gestion de la pagination
	pageStr := c.DefaultQuery("page", "1")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	// On appelle le service avec le statut dynamique
	results, err := h.service.GetUserSeriesOrderByStatus(userID.(string), page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"page":          page,
		"results":       results,
		"has_next_page": len(results) == 20,
	})
}

// GET /api/tv/:id
func (h *Handler) HandlerGetDetails(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	seriesIDStr := c.Param("id")
	seriesID, err := strconv.Atoi(seriesIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de série invalide"})
		return
	}

	details, err := h.service.GetSeriesDetailsForUser(userID.(string), seriesID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, details)
}

// POST /api/tv/status (Ajouter à la watchlist ou aux favoris sans regarder d'épisode)
func (h *Handler) HandlerUpdateStatus(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	var req UpdateSeriesStatusPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide"})
		return
	}

	err := h.service.UpdateSeriesStatus(userID.(string), req.TMDBSeriesID, req.StatusLocal, req.IsFavorite, time.Now(), time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Statut de la série mis à jour"})
}

// DELETE /api/tv/:id (Supprimer complètement la série du profil)
func (h *Handler) HandlerRemoveSeries(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	seriesID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	if err := h.service.RemoveSeries(userID.(string), seriesID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Série supprimée avec succès"})
}

// GET /api/tv/favorites
func (h *Handler) HandlerGetFavorites(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	results, err := h.service.GetFavoritesForUser(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// DELETE /api/tv/:id/season/:season/episode/:episode (Annuler le visionnage d'un épisode)
func (h *Handler) HandlerRemoveEpisode(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	seriesID, _ := strconv.Atoi(c.Param("id"))
	seasonNum, _ := strconv.Atoi(c.Param("season"))
	episodeNum, _ := strconv.Atoi(c.Param("episode"))

	if err := h.service.RemoveEpisode(userID.(string), seriesID, seasonNum, episodeNum); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Épisode retiré de l'historique"})
}

// GET /api/tv/:id/similar
func (h *Handler) HandlerGetSimilarSeries(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	seriesID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	results, err := h.service.GetSimilarSeries(userID.(string), seriesID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// GET /api/tv/:id/season/:season
func (h *Handler) HandlerGetSeasonDetails(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	seriesID, errID := strconv.Atoi(c.Param("id"))
	seasonNum, errSeason := strconv.Atoi(c.Param("season"))
	if errID != nil || errSeason != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paramètres invalides"})
		return
	}

	details, err := h.service.GetSeasonDetailsForUser(userID.(string), seriesID, seasonNum)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, details)
}

// POST (ou PUT) /api/tv/:id/season/:season/episode/:episode/decrement
func (h *Handler) HandlerDecrementEpisode(c *gin.Context) {
	userID, _ := c.Get("clerkUserID")

	seriesID, _ := strconv.Atoi(c.Param("id"))
	seasonNum, _ := strconv.Atoi(c.Param("season"))
	episodeNum, _ := strconv.Atoi(c.Param("episode"))

	if err := h.service.DecrementEpisode(userID.(string), seriesID, seasonNum, episodeNum); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rewatch décrémenté avec succès"})
}

type WatchAllPayload struct {
	TMDBSeriesID int `json:"tmdb_id"`
	SeasonNumber int `json:"season_number"`
}

func (h *Handler) HandlerWatchAllEpisodesInSeason(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non authentifié"})
		return
	}

	var req WatchAllPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide"})
		return
	}

	err := h.service.WatchAllEpisodesInSeason(userID.(string), req.TMDBSeriesID, req.SeasonNumber)
	if err != nil {
		fmt.Printf("Erreur WatchAll: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Toute la saison a été marquée comme vue"})
}

func (h *Handler) HandlerGetUpcomingSeries(c *gin.Context) {
	userID, _ := c.Get("clerkUserID")
	pageStr := c.DefaultQuery("page", "1")
	page, _ := strconv.Atoi(pageStr)

	results, err := h.service.GetUpcomingSeries(userID.(string), page)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"page": page, "results": results, "has_next_page": len(results) == 20})
}
