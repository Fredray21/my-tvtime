package notification

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type subscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys"`
}

// GET /api/v1/push/config : la clé publique permet au navigateur de créer l'abonnement
func (h *Handler) HandleGetConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"enabled":    h.service.Enabled(),
		"public_key": h.service.PublicKey(),
	})
}

// POST /api/v1/push/subscribe (format standard PushSubscription.toJSON())
func (h *Handler) HandleSubscribe(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}
	if !h.service.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Notifications non configurées sur le serveur"})
		return
	}

	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Keys.P256dh == "" || req.Keys.Auth == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Abonnement invalide"})
		return
	}

	err := h.service.Subscribe(Subscription{
		Endpoint: req.Endpoint,
		UserID:   userID.(string),
		P256dh:   req.Keys.P256dh,
		Auth:     req.Keys.Auth,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'enregistrement de l'abonnement"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "subscribed"})
}

// POST /api/v1/push/unsubscribe
func (h *Handler) HandleUnsubscribe(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Endpoint manquant"})
		return
	}

	if err := h.service.Unsubscribe(userID.(string), req.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la désinscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unsubscribed"})
}

// POST /api/v1/push/test : envoie une notification de test sur tous les appareils de l'utilisateur
func (h *Handler) HandleTest(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	sent, err := h.service.SendToUser(userID.(string), Payload{
		Title: "My TV Time",
		Body:  "Les notifications fonctionnent ! Tu seras prévenu des nouveaux épisodes et des sorties de ta watchlist.",
		URL:   "/profile",
		Tag:   "test",
	})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sent": sent})
}
