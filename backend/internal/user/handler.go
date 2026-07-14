package user

import (
	"net/http"
	"strconv"

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

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	movies, err := h.service.GetLatestWatchedMovies(userID.(string), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Service error", "details": err.Error()})
		return
	}

	hasNextPage := len(movies) > limit
	if hasNextPage {
		movies = movies[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"results":       movies,
		"page":          page,
		"has_next_page": hasNextPage,
	})
}

// GET /api/user/tv/latest
func (h *Handler) HandleGetLatestTV(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	// On récupère les épisodes vus
	episodes, err := h.service.GetLatestWatchedTV(userID.(string), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	hasNextPage := len(episodes) > limit
	if hasNextPage {
		episodes = episodes[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"results":       episodes,
		"page":          page,
		"has_next_page": hasNextPage,
	})
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
