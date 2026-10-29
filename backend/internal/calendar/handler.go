package calendar

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

// GET /api/v1/user/calendar?type=tv|movie&days=60
func (h *Handler) HandleGetCalendar(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	mediaType := c.Query("type")
	if mediaType != "" && mediaType != "tv" && mediaType != "movie" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type invalide"})
		return
	}

	days, err := strconv.Atoi(c.DefaultQuery("days", "60"))
	if err != nil || days < 1 || days > 730 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre de jours invalide (1 à 730)"})
		return
	}

	calendar, err := h.service.GetCalendar(userID.(string), mediaType, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, calendar)
}
