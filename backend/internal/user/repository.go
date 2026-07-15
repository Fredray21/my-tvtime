package user

import (
	"database/sql"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// EnsureUserExists fait l'upsert JIT au niveau global
func (r *Repository) EnsureUserExists(clerkUserID string) error {
	query := `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`
	_, err := r.db.Exec(query, clerkUserID)
	return err
}
