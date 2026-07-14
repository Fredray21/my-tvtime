package movie

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *MovieService
}

func NewHandler(service *MovieService) *Handler {
	return &Handler{service: service}
}

// UpdateRequest représente le JSON attendu du front
type UpdateRequest struct {
	TMDBMovieID  int    `json:"tmdb_id" binding:"required"`
	StatusLocal  string `json:"status_local" binding:"required"`
	IsFavorite   bool   `json:"is_favorite"`
	RewatchCount int    `json:"rewatch_count"`
}

// 2. POST /api/movies/status
func (h *Handler) HandleUpdateStatus(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	var req UpdateRequest
	// ShouldBindJSON s'occupe de parser le JSON et de valider les champs requis
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide ou champs obligatoires manquants"})
		return
	}

	err := h.service.UpdateMovieStatus(userID.(string), req.TMDBMovieID, req.StatusLocal, req.IsFavorite, req.RewatchCount, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Statut mis à jour avec succès"})
}

// 3. DELETE /api/movies/:id
func (h *Handler) HandleRemove(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	// Grâce à Gin, on peut récupérer proprement l'ID directement dans l'URL
	idParam := c.Param("id")
	tmdbMovieID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de film TMDB invalide"})
		return
	}

	err = h.service.RemoveMovie(userID.(string), tmdbMovieID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Film retiré de votre liste"})
}

// 3. GET /api/movies/watchlist
func (h *Handler) HandleGetWatchlist(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	pageStr := c.DefaultQuery("page", "1")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	results, err := h.service.GetWatchlistForUser(userID.(string), page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"page":    page,
		"results": results,
		// Si on a récupéré moins de 20 films, c'est qu'on est à la fin de la liste !
		"has_next_page": len(results) == 20,
	})
}

// 4. GET /api/movies/favorites
func (h *Handler) HandleGetFavorites(c *gin.Context) {
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

func (h *Handler) HandleGetDetails(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	idParam := c.Param("id")
	movieID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de film invalide"})
		return
	}

	result, err := h.service.GetMovieDetailsForUser(userID.(string), movieID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) HandleGetSimilarMovies(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}

	idParam := c.Param("id")
	movieID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	movies, err := h.service.GetSimilarMovies(userID.(string), movieID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des recommandations"})
		return
	}

	c.JSON(http.StatusOK, movies)
}
