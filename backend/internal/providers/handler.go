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
	service    *Service
}

func NewHandler(tmdbClient *tmdb.Client, service *Service) *Handler {
	return &Handler{tmdbClient: tmdbClient, service: service}
}

// GET /api/v1/providers/catalog : plateformes proposées dans "Mes plateformes"
func (h *Handler) HandleGetCatalog(c *gin.Context) {
	catalog, err := h.service.Catalog()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la récupération des plateformes"})
		return
	}
	c.JSON(http.StatusOK, catalog)
}

// GET /api/v1/user/providers
func (h *Handler) HandleGetUserProviders(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}
	ids, err := h.service.GetUserProviders(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"provider_ids": ids})
}

// PUT /api/v1/user/providers  { "provider_ids": [8, 119] } : remplace la sélection
func (h *Handler) HandleSetUserProviders(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Utilisateur non authentifié"})
		return
	}
	var req struct {
		ProviderIDs []int `json:"provider_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide"})
		return
	}
	ids, err := h.service.SetUserProviders(userID.(string), req.ProviderIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"provider_ids": ids})
}

// HandleGetProviders renvoie un handler pour GET /movies/:id/providers ou /tvs/:id/providers (?region=FR par défaut)
func (h *Handler) HandleGetProviders(mediaType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tmdbID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
			return
		}

		region := strings.ToUpper(c.DefaultQuery("region", Region))

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
