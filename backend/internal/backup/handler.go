package backup

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Taille max d'une sauvegarde (plusieurs milliers d'épisodes tiennent en quelques Mo)
const maxBackupSize = 50 << 20

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GET /user/export : télécharge le fichier de sauvegarde
func (h *Handler) HandleExport(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	file, err := h.service.Export(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Échec de l'export"})
		return
	}

	filename := fmt.Sprintf("my-tvtime-%s.json", time.Now().Format("2006-01-02"))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.IndentedJSON(http.StatusOK, file)
}

// POST /import/backup : importe un fichier de sauvegarde (champ "file")
func (h *Handler) HandleImport(c *gin.Context) {
	userID, exists := c.Get("clerkUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Non autorisé"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fichier de sauvegarde manquant"})
		return
	}
	if fileHeader.Size > maxBackupSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Fichier trop volumineux"})
		return
	}
	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Impossible d'ouvrir le fichier"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(io.LimitReader(f, maxBackupSize))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lecture du fichier impossible"})
		return
	}

	backup, err := Parse(data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.Import(userID.(string), backup)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Échec de l'import, rien n'a été modifié"})
		return
	}
	c.JSON(http.StatusOK, result)
}
