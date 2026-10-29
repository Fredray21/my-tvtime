package person

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *PersonService
}

func NewHandler(service *PersonService) *Handler {
	return &Handler{service: service}
}

// GET /api/v1/persons/:id
func (h *Handler) HandleGetDetails(c *gin.Context) {
	personID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non authentifié"})
		return
	}

	details, err := h.service.GetPersonDetails(userID.(string), personID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération de la personne"})
		return
	}

	c.JSON(http.StatusOK, details)
}
