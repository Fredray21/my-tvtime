package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/Fredray21/my-tvtime/internal/user"
	"github.com/MicahParks/keyfunc/v2"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Middleware de test pour bypasser Clerk en local
func DummyAuthMiddleware(userRepo *user.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {

		err := userRepo.EnsureUserExists("user_test_12345")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Échec de la synchronisation de l'utilisateur en BDD"})
			c.Abort()
			return
		}

		c.Set("clerkUserID", "user_test_12345")
		c.Next()
	}
}

// ClerkAuth validates the JWT sent by the frontend using RS256 and JWKS
func ClerkAuthMiddleware(userRepo *user.Repository) gin.HandlerFunc {
	// Retrieve JWKS URL from environment variables
	jwksURL := os.Getenv("CLERK_JWKS_URL")
	if jwksURL == "" {
		panic("CLERK_JWKS_URL must be set in environment variables")
	}

	// Create JWKS cache to avoid fetching keys on every request
	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{})
	if err != nil {
		panic("Failed to create JWKS from Clerk: " + err.Error())
	}

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header missing"})
			return
		}

		// Remove "Bearer " prefix
		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)

		// Validate token with RS256 + JWKS
		token, err := jwt.Parse(tokenString, jwks.Keyfunc)
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Extract user ID (sub) from JWT claims and inject into Gin context
		claims := token.Claims.(jwt.MapClaims)

		clerkID, ok := claims["sub"].(string)
		if !ok || clerkID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token Clerk manquant ou invalide"})
			c.Abort()
			return
		}

		// 2. LA MAGIE DE LA SYNCRO : On s'assure qu'il existe dans notre Postgres
		errSync := userRepo.EnsureUserExists(clerkID)
		if errSync != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Échec de la synchronisation de l'utilisateur en BDD"})
			c.Abort()
			return
		}

		c.Set("clerkUserID", clerkID)
		c.Next()
	}
}
