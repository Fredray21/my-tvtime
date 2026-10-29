package providers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/gin-gonic/gin"
)

type Provider struct {
	ProviderID      int    `json:"provider_id"`
	ProviderName    string `json:"provider_name"`
	LogoPath        string `json:"logo_path"`
	DisplayPriority int    `json:"display_priority"`
}

// RegionProviders : plateformes disponibles dans un pays (données JustWatch via TMDB)
type RegionProviders struct {
	Link     string     `json:"link"`
	Flatrate []Provider `json:"flatrate"`
	Free     []Provider `json:"free"`
	Ads      []Provider `json:"ads"`
	Rent     []Provider `json:"rent"`
	Buy      []Provider `json:"buy"`
}

type Handler struct {
	tmdbClient *tmdb.Client
}

func NewHandler(tmdbClient *tmdb.Client) *Handler {
	return &Handler{tmdbClient: tmdbClient}
}

// HandleGetProviders renvoie un handler pour GET /movies/:id/providers ou /tvs/:id/providers (?region=FR par défaut)
func (h *Handler) HandleGetProviders(mediaType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tmdbID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
			return
		}

		region := strings.ToUpper(c.DefaultQuery("region", "FR"))

		data, err := h.tmdbClient.GetWatchProviders(mediaType, tmdbID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des plateformes"})
			return
		}

		var tmdbData struct {
			Results map[string]RegionProviders `json:"results"`
		}
		if err := json.Unmarshal(data, &tmdbData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Réponse TMDB invalide"})
			return
		}

		// Pas de plateforme dans ce pays : on renvoie une structure vide plutôt qu'une erreur
		result := tmdbData.Results[region]
		c.JSON(http.StatusOK, result)
	}
}
