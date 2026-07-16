package tmdb

import (
	"context"
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

	return c.get(reqURL)
}

// SearchPaged interroge un endpoint spécifique (movie, tv, person) avec pagination
func (c *Client) SearchPaged(searchType string, query string, page int) ([]byte, error) {
	encodedQuery := url.QueryEscape(query)
	reqURL := fmt.Sprintf("%s/search/%s?api_key=%s&query=%s&language=fr-FR&page=%d&include_adult=false", c.baseURL, searchType, c.apiKey, encodedQuery, page)
	return c.get(reqURL)
}

func (c *Client) SearchMovie(title string) ([]byte, error) {
	encodedQuery := url.QueryEscape(title)
	reqURL := fmt.Sprintf("%s/search/movie?api_key=%s&query=%s", c.baseURL, c.apiKey, encodedQuery)
	return c.get(reqURL)
}

func (c *Client) SearchTVShow(title string) ([]byte, error) {
	encodedQuery := url.QueryEscape(title)
	reqURL := fmt.Sprintf("%s/search/tv?api_key=%s&query=%s", c.baseURL, c.apiKey, encodedQuery)
	return c.get(reqURL)
}

// GetMovieDetails récupère les infos complètes d'un film (synopsis, note, poster...)
func (c *Client) GetMovieDetails(tmdbMovieID int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/movie/%d?api_key=%s&language=fr-FR", c.baseURL, tmdbMovieID, c.apiKey)
	return c.get(reqURL)
}

func (c *Client) GetSimilarMovie(movieID int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/movie/%d/similar?api_key=%s&language=fr-FR", c.baseURL, movieID, c.apiKey)
	return c.get(reqURL)
}

// GetSeriesTotalEpisodes interroge TMDB pour récupérer le nombre total d'épisodes d'une série
func (c *Client) GetSeriesTotalEpisodes(ctx context.Context, tmdbSeriesID int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/tv/%d?api_key=%s&language=fr-FR", c.baseURL, tmdbSeriesID, c.apiKey)
	return c.get(reqURL)
}

// GetSeriesDetails renvoie le JSON brut des détails d'une série
func (c *Client) GetSeriesDetails(seriesID int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/tv/%d?api_key=%s&language=fr-FR", c.baseURL, seriesID, c.apiKey)
	return c.get(reqURL)
}

// GetSeasonDetails renvoie le JSON brut d'une saison
func (c *Client) GetSeasonDetails(seriesID int, seasonNumber int) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/tv/%d/season/%d?api_key=%s&language=fr-FR", c.baseURL, seriesID, seasonNumber, c.apiKey)
	return c.get(reqURL)
}

// GetSimilarSeries récupère les séries similaires depuis TMDB (JSON brut)
func (c *Client) GetSimilarSeries(seriesID int) ([]byte, error) {
	url := fmt.Sprintf("%s/tv/%d/similar?api_key=%s&language=fr-FR", c.baseURL, seriesID, c.apiKey)
	return c.get(url)
}

func (c *Client) GetEpisodeDetails(seriesID int, seasonNumber int, episodeNumber int) ([]byte, error) {
	url := fmt.Sprintf("%s/tv/%d/season/%d/episode/%d?api_key=%s&language=fr-FR", c.baseURL, seriesID, seasonNumber, episodeNumber, c.apiKey)
	return c.get(url)
}

func (c *Client) GetTMDBIDFromTVDB(tvdbID int) ([]byte, error) {
	url := fmt.Sprintf("%s/find/%d?api_key=%s&external_source=tvdb_id", c.baseURL, tvdbID, c.apiKey)
	return c.get(url)
}

func (r *Repository) GetCredits(tmdbID int, mediaType string) ([]byte, error) {
    url := fmt.Sprintf("/%s/%d/credits?api_key=%s&language=fr-FR", mediaType, tmdbID, r.apiKey)
    return c.get(url)
}



func (c *Client) get(url string) ([]byte, error) {
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tmdb returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}
