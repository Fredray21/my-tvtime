package discover

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GET /api/v1/discover/:type/:list?page=...
// type : movie | tv — list : trending, now_playing, upcoming, popular, top_rated, on_the_air
func (h *Handler) HandleGetList(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non authentifié"})
		return
	}

	mediaType := c.Param("type")
	list := c.Param("list")
	if !IsValidList(mediaType, list) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Liste inconnue"})
		return
	}

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	result, err := h.service.GetList(userID.(string), mediaType, list, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
