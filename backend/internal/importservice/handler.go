package importservice

import (
	"io"
	"net/http"

	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/tv"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ImportHandler struct {
	importer *TVTimeImporter
	manager  *TaskManager
	mo       *movie.MovieService
	tv       *tv.TVService
}

func NewImportHandler(importer *TVTimeImporter, manager *TaskManager, movieService *movie.MovieService, tvService *tv.TVService) *ImportHandler {
	return &ImportHandler{
		importer: importer,
		manager:  manager,
		mo:       movieService,
		tv:       tvService,
	}
}

// 1. POST /api/v1/import/tvtime/upload
func (h *ImportHandler) HandleUploadTVTime(c *gin.Context) {
	_, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fichier ZIP manquant ou invalide"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible d'ouvrir le fichier ZIP"})
		return
	}
	defer file.Close()

	// Lecture complète du fichier en mémoire
	zipBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la lecture du fichier"})
		return
	}

	// Création de la tâche asynchrone
	taskID := uuid.New().String()
	status := &TaskStatus{
		ID:            taskID,
		State:         "processing",
		Progress:      "Fichier reçu. Début de l'analyse du ZIP...",
		PercentTV:     0,
		PercentMovies: 0,
	}
	h.manager.Set(taskID, status)

	go h.importer.StartAsyncAnalysis(taskID, zipBytes)

	// Retourne immédiatement un code 202 "Accepted" avec le taskID
	c.JSON(http.StatusAccepted, gin.H{
		"task_id": taskID,
		"message": "Fichier reçu avec succès. Analyse démarrée.",
	})
}

// 2. GET /api/v1/import/tvtime/status/:taskID
func (h *ImportHandler) HandleGetStatus(c *gin.Context) {
	_, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	taskID := c.Param("taskID")
	status, found := h.manager.Get(taskID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tâche d'import introuvable"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// POST /api/v1/import/tvtime/confirm
func (h *ImportHandler) HandleConfirmImport(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	var req ImportAnalysisResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données d'importation invalides"})
		return
	}

	// 1. Création d'une nouvelle tâche de suivi pour l'écriture
	taskID := uuid.New().String()
	status := &TaskStatus{
		ID:        taskID,
		State:     "processing",
		Progress:  "Initialisation de la base de données pour l'écriture...",
		PercentTV: 0,
	}
	h.manager.Set(taskID, status)

	go h.importer.ExecuteDatabaseImport(taskID, userID.(string), req, h.tv, h.mo)

	// 3. Réponse immédiate au frontend
	c.JSON(http.StatusAccepted, gin.H{
		"task_id": taskID,
		"message": "Enregistrement en base de données démarré.",
	})
}
