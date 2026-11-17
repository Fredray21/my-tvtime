package providers

import (
	"fmt"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// Service : plateformes de l'utilisateur ("Mes plateformes") et catalogue des plateformes françaises
type Service struct {
	repo       *Repository
	tmdbClient *tmdb.Client
}

func NewService(repo *Repository, tmdbClient *tmdb.Client) *Service {
	return &Service{repo: repo, tmdbClient: tmdbClient}
}

// Catalog : plateformes disponibles en France (le cache TMDB de 24h évite de le recalculer à chaque appel)
func (s *Service) Catalog() ([]CatalogProvider, error) {
	return BuildCatalog(s.tmdbClient)
}

func (s *Service) GetUserProviders(userID string) ([]int, error) {
	return s.repo.GetUserProviders(userID)
}

const maxUserProviders = 40

func (s *Service) SetUserProviders(userID string, providerIDs []int) ([]int, error) {
	if len(providerIDs) > maxUserProviders {
		return nil, fmt.Errorf("trop de plateformes (max %d)", maxUserProviders)
	}
	unique := make([]int, 0, len(providerIDs))
	seen := make(map[int]bool)
	for _, id := range providerIDs {
		if id <= 0 {
			return nil, fmt.Errorf("plateforme invalide: %d", id)
		}
		if !seen[id] {
			seen[id] = true
			unique = append(unique, id)
		}
	}
	if err := s.repo.SetUserProviders(userID, unique); err != nil {
		return nil, err
	}
	return unique, nil
}

// MatchIDs : plateformes de l'utilisateur + leurs variantes (ex : Netflix + Netflix avec pub)
func (s *Service) MatchIDs(userID string) ([]int, error) {
	selected, err := s.repo.GetUserProviders(userID)
	if err != nil || len(selected) == 0 {
		return selected, err
	}
	catalog, err := s.Catalog()
	if err != nil {
		// Sans catalogue, on se contente de la sélection brute
		return selected, nil
	}
	return ExpandWithAliases(selected, catalog), nil
}
