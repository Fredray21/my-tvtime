package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *UserService
}

func NewHandler(service *UserService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) HandleGetLatestMovies(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	movies, err := h.service.GetLatestWatchedMovies(userID.(string), 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Service error", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movies)
}

// GET /api/user/tv/latest
func (h *Handler) HandleGetLatestTV(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	// On récupère les 20 derniers épisodes vus
	episodes, err := h.service.GetLatestWatchedTV(userID.(string), 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, episodes)
}

// GET /api/user/stats
func (h *Handler) HandleGetUserStats(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	stats, err := h.service.GetUserStats(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
