package search

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *SearchService
}

func NewHandler(service *SearchService) *Handler {
	return &Handler{service: service}
}

// GET /api/search/multi?q=...
func (h *Handler) HandleMultiSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Le paramètre 'q' est requis"})
		return
	}

	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non authentifié"})
		return
	}

	results, err := h.service.GetMultiSearch(userID.(string), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GET /api/search/:type?q=...&page=...
func (h *Handler) HandlePagedSearch(c *gin.Context) {
	searchType := c.Param("type")
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Le paramètre 'q' est requis"})
		return
	}

	// Validation du type autorisé
	if searchType != "movie" && searchType != "tv" && searchType != "person" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type de recherche invalide"})
		return
	}

	pageStr := c.DefaultQuery("page", "1")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	userID, _ := c.Get("clerkUserID")

	results, err := h.service.GetPagedSearch(userID.(string), searchType, query, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
