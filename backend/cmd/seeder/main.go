package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
	_ "github.com/lib/pq"
)

func main() {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	tmdbClient := tmdb.NewClient(os.Getenv("TMDB_API_KEY"))

	// --- 1. SYNCHRO FILMS ---
	fmt.Println("--- Début synchro Films ---")
	rowsM, err := db.Query("SELECT DISTINCT tmdb_movie_id FROM user_movies")
	if err == nil {
		for rowsM.Next() {
			var id int
			rowsM.Scan(&id)
			data, err := tmdbClient.GetMovieDetails(id)
			if err != nil { continue }

			var m struct {
				Title       string `json:"title"`
				ReleaseDate string `json:"release_date"`
				Runtime     int    `json:"runtime"`
			}
			json.Unmarshal(data, &m)

			_, err = db.Exec(`
				INSERT INTO movie_metadata (tmdb_movie_id, title, release_date, runtime, updated_at)
				VALUES ($1, $2, $3, $4, NOW())
				ON CONFLICT (tmdb_movie_id) DO UPDATE 
				SET title = EXCLUDED.title, release_date = EXCLUDED.release_date, runtime = EXCLUDED.runtime, updated_at = NOW()`,
				id, m.Title, m.ReleaseDate, m.Runtime)
			
			if err != nil { log.Printf("Erreur Film %d: %v", id, err) }
			time.Sleep(250 * time.Millisecond)
		}
		rowsM.Close()
	}

	// --- 2. SYNCHRO SÉRIES ---
	fmt.Println("--- Début synchro Séries ---")
	rowsS, err := db.Query("SELECT DISTINCT tmdb_series_id FROM user_series")
	if err == nil {
		for rowsS.Next() {
			var id int
			rowsS.Scan(&id)
			data, err := tmdbClient.GetSeriesDetails(id)
			if err != nil { continue }

			var s struct { Seasons []struct { SeasonNumber int `json:"season_number"` } `json:"seasons"` }
			json.Unmarshal(data, &s)

			for _, sn := range s.Seasons {
				sData, _ := tmdbClient.GetSeasonDetails(id, sn.SeasonNumber)
				var season struct {
					Episodes []struct {
						EpNum   int    `json:"episode_number"`
						SeaNum  int    `json:"season_number"`
						AirDate string `json:"air_date"`
						Runtime int    `json:"runtime"`
					} `json:"episodes"`
				}
				json.Unmarshal(sData, &season)

				for _, ep := range season.Episodes {
					if ep.AirDate == "" { continue }
					_, err := db.Exec(`
						INSERT INTO episode_metadata (tmdb_series_id, season_number, episode_number, runtime, air_date, updated_at)
						VALUES ($1, $2, $3, $4, $5, NOW())
						ON CONFLICT (tmdb_series_id, season_number, episode_number) DO UPDATE 
						SET runtime = EXCLUDED.runtime, air_date = EXCLUDED.air_date, updated_at = NOW()`,
						id, ep.SeaNum, ep.EpNum, ep.Runtime, ep.AirDate)
					
					if err != nil { log.Printf("Erreur Ep %d S%d: %v", ep.EpNum, ep.SeaNum, err) }
				}
			}
			time.Sleep(250 * time.Millisecond)
		}
		rowsS.Close()
	}
	fmt.Println("Synchronisation terminée avec succès !")
}