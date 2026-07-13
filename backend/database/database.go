package database

import (
	"database/sql"
	"embed"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// ConnectAndMigrate establishes a connection to PostgreSQL and applies missing migrations
func ConnectAndMigrate(host, user, password, dbName string) (*sql.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", host, user, password, dbName)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established successfully.")

	// Setup migration source using Go embedded filesystem
	sourceDriver, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return nil, fmt.Errorf("failed to create migration source driver: %w", err)
	}

	// Setup database driver for migrations
	dbDriver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to create migration database driver: %w", err)
	}

	// Initialize controller
	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize migration instance: %w", err)
	}

	// Apply migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return nil, fmt.Errorf("failed to apply migrations: %w", err)
	}

	log.Println("Database migrations applied up to date.")
	return db, nil
}
