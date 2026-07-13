package main

import (
	"log"
	"os"

	"github.com/Fredray21/my-tvtime/database"
	"github.com/Fredray21/my-tvtime/internal/middleware"
	"github.com/Fredray21/my-tvtime/internal/movie"
	"github.com/Fredray21/my-tvtime/internal/search"
	"github.com/Fredray21/my-tvtime/internal/tmdb"
	"github.com/Fredray21/my-tvtime/internal/user"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	dbHost := getEnv("DB_HOST", "localhost")
	dbUser := getEnv("DB_USER", "your_user_here")
	dbPassword := getEnv("DB_PASSWORD", "your_super_secret_password_here")
	dbName := getEnv("DB_NAME", "mytvtime_db")
	apiPort := getEnv("API_PORT", "8080")
	FRONTEND_URL := getEnv("FRONTEND_URL", "http://localhost:3000")

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.ConnectAndMigrate(dbHost, dbUser, dbPassword, dbName)
	if err != nil {
		log.Fatalf("Critical error during database initialization: %v", err)
	}
	defer db.Close()

	tmdbClient := tmdb.NewClient(os.Getenv("TMDB_API_KEY"))

	userRepo := user.NewRepository(db)
	movieRepo := movie.NewRepository(db)

	movieService := movie.NewService(movieRepo, tmdbClient)
	movieHandler := movie.NewHandler(movieService)

	userService := user.NewService(userRepo, tmdbClient, movieService)
	userHandler := user.NewHandler(userService)

	searchService := search.NewService(tmdbClient, movieService)
	searchHandler := search.NewHandler(searchService)

	r := gin.Default()

	// Global Middleware (CORS, Recovery, Logger)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{FRONTEND_URL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.Use(gin.Recovery())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "UP"})
	})

	api := r.Group("/api/v1")
	api.Use(middleware.ClerkAuthMiddleware(userRepo)) // middleware.DummyAuthMiddleware(userRepo) | middleware.ClerkAuthMiddleware(userRepo)
	{
		// Movie
		movieRoutes := api.Group("/movies")
		{
			movieRoutes.POST("/status", movieHandler.HandleUpdateStatus)
			movieRoutes.DELETE("/:id", movieHandler.HandleRemove)
			movieRoutes.GET("/favorites", movieHandler.HandleGetFavorites)
			movieRoutes.GET("/:id", movieHandler.HandleGetDetails)
			movieRoutes.GET("/watchlist", movieHandler.HandleGetWatchlist)
			movieRoutes.GET("/:id/similar", movieHandler.HandleGetSimilarMovies)
		}

		// Search
		api.GET("/search/multi", searchHandler.HandleMultiSearch)
		api.GET("/search/:type", searchHandler.HandlePagedSearch)

		// User
		api.GET("/user/stats", userHandler.HandleGetUserStats)
		api.GET("/user/movies/latest", userHandler.HandleGetLatestMovies)

	}

	// Start Server
	log.Printf("Starting my-tvtime API server on port %s...", apiPort)
	if err := r.Run(":" + apiPort); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

// Simple helper to read environment variables with a fallback default value
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
