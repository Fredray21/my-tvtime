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

func (h *Handler) HandleGetUserStats(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non authentifié"})
		return
	}

	stats, err := h.service.GetUserStats(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
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
