package importservice

import (
	"sync"
	"time"
)

// Objet de bilan renvoyé au frontend
type ImportAnalysisResponse struct {
	Movies struct {
		ToImport []MovieImportItem `json:"to_import"`
		NotFound []string          `json:"not_found"`
	} `json:"movies"`
	TV struct {
		ToImport []TVImportItem `json:"to_import"`
		NotFound []string       `json:"not_found"`
	} `json:"tv"`
}

type MovieImportItem struct {
	Title         string    `json:"title"`
	TMDBID        int       `json:"tmdb_id"`
	WatchedAt     time.Time `json:"watched_at"`
	WatchlistOnly bool      `json:"watchlist_only"`
	RewatchCount  int       `json:"rewatch_count"`
}

type TVImportItem struct {
	Title      string           `json:"title"`
	TMDBID     int              `json:"tmdb_id"`
	Episodes   []WatchedEpisode `json:"episodes"`
	Watchlist  bool             `json:"watchlist"`
	IsFavorite bool             `json:"is_favorite"`
}

type WatchedEpisode struct {
	Season       int       `json:"season"`
	Episode      int       `json:"episode"`
	RewatchCount int       `json:"rewatch_count"`
	WatchedAt    time.Time `json:"watched_at"`
}

type TaskStatus struct {
	ID            string                  `json:"id"`
	State         string                  `json:"state"`    // "processing", "completed", "failed"
	Progress      string                  `json:"progress"` // Texte affiché
	PercentTV     int                     `json:"percent_tv"`
	PercentMovies int                     `json:"percent_movies"`
	Result        *ImportAnalysisResponse `json:"result,omitempty"`
	Error         string                  `json:"error,omitempty"`
	LastActive    time.Time               `json:"-"`
}

// Un store en mémoire pour stocker l'état des tâches actives
type TaskManager struct {
	mu    sync.RWMutex
	tasks map[string]*TaskStatus
}

func NewTaskManager() *TaskManager {
	return &TaskManager{
		tasks: make(map[string]*TaskStatus),
	}
}

func (tm *TaskManager) Set(taskID string, status *TaskStatus) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	status.LastActive = time.Now()
	tm.tasks[taskID] = status
}

func (tm *TaskManager) Get(taskID string) (*TaskStatus, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	status, exists := tm.tasks[taskID]
	return status, exists
}
