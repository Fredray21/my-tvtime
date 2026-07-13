package media

import (
	"net/http"
	"strconv"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *movie.MovieService
}

func NewHandler(service *movie.MovieService) *Handler {
	return &Handler{service: service}
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

	mediaType := c.DefaultQuery("type", "movie")

	results, err := h.service.GetWatchlistForUser(userID.(string), page, mediaType)
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
