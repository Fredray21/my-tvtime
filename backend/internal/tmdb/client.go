package tmdb

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client structure notre client HTTP pour TMDB
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewClient initialise le client avec la clé d'API passée depuis main.go
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: "https://api.themoviedb.org/3",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SearchMulti interroge l'endpoint multi de TMDB (Films, Séries, Acteurs mélangés)
func (c *Client) SearchMulti(query string) ([]byte, error) {
	encodedQuery := url.QueryEscape(query)
	reqURL := fmt.Sprintf("%s/search/multi?api_key=%s&query=%s&language=fr-FR&include_adult=false", c.baseURL, c.apiKey, encodedQuery)

	resp, err := c.httpClient.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("erreur lors de l'appel TMDB Search Multi: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("erreur décodage JSON TMDB Search Multi: %w", err)
	}
	return json.Marshal(result)
}

// SearchPaged interroge un endpoint spécifique (movie, tv, person) avec pagination
func (c *Client) SearchPaged(searchType string, query string, page int) ([]byte, error) {
	encodedQuery := url.QueryEscape(query)
	reqURL := fmt.Sprintf("%s/search/%s?api_key=%s&query=%s&language=fr-FR&page=%d&include_adult=false", c.baseURL, searchType, c.apiKey, encodedQuery, page)

	resp, err := c.httpClient.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("erreur lors de l'appel TMDB Search Paged (%s): %w", searchType, err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("erreur décodage JSON TMDB Search Paged: %w", err)
	}
	return json.Marshal(result)
}

// GetMovieDetails récupère les infos complètes d'un film (synopsis, note, poster...)
func (c *Client) GetMovieDetails(tmdbMovieID int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/movie/%d?api_key=%s&language=fr-FR", c.baseURL, tmdbMovieID, c.apiKey)

	resp, err := c.httpClient.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("erreur lors de l'appel TMDB Details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB Details a renvoyé un statut invalide: %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("erreur décodage JSON TMDB Details: %w", err)
	}

	return json.Marshal(result)
}

func (c *Client) GetSimilarMovie(movieID int) ([]byte, error) {
	url := fmt.Sprintf("%s/movie/%d/recommendations?api_key=%s&language=fr-FR", c.baseURL, movieID, c.apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("erreur API TMDB: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}
