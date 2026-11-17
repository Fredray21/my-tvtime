package providers

import (
	"database/sql"

	"github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetUserProviders renvoie les identifiants des plateformes auxquelles l'utilisateur est abonné
func (r *Repository) GetUserProviders(userID string) ([]int, error) {
	rows, err := r.db.Query(`SELECT provider_id FROM user_providers WHERE user_id = $1 ORDER BY created_at, provider_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int, 0)
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// SetUserProviders remplace toute la sélection de l'utilisateur (en une transaction)
func (r *Repository) SetUserProviders(userID string, providerIDs []int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM user_providers WHERE user_id = $1 AND NOT (provider_id = ANY($2))`, userID, pq.Array(providerIDs)); err != nil {
		return err
	}
	for _, id := range providerIDs {
		if _, err := tx.Exec(`INSERT INTO user_providers (user_id, provider_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}
