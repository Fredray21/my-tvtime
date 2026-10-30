package notification

import "database/sql"

type Subscription struct {
	Endpoint string
	UserID   string
	P256dh   string
	Auth     string
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// SaveSubscription enregistre (ou met à jour) l'abonnement d'un appareil
func (r *Repository) SaveSubscription(sub Subscription) error {
	query := `
		INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth,
			updated_at = CURRENT_TIMESTAMP`
	_, err := r.db.Exec(query, sub.Endpoint, sub.UserID, sub.P256dh, sub.Auth)
	return err
}

// DeleteSubscription supprime un abonnement (désactivation, ou abonnement expiré côté navigateur)
func (r *Repository) DeleteSubscription(endpoint string) error {
	_, err := r.db.Exec(`DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}

// DeleteUserSubscription : un utilisateur ne peut supprimer que ses propres appareils
func (r *Repository) DeleteUserSubscription(userID string, endpoint string) error {
	_, err := r.db.Exec(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	return err
}

func (r *Repository) GetSubscriptions(userID string) ([]Subscription, error) {
	rows, err := r.db.Query(`SELECT endpoint, user_id, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.Endpoint, &sub.UserID, &sub.P256dh, &sub.Auth); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

// GetSubscribedUsers liste les utilisateurs ayant au moins un appareil abonné
func (r *Repository) GetSubscribedUsers() ([]string, error) {
	rows, err := r.db.Query(`SELECT DISTINCT user_id FROM push_subscriptions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		users = append(users, userID)
	}
	return users, nil
}

// MarkNotified renvoie true si cette sortie n'avait pas encore été notifiée à cet utilisateur
// (detail : "S3E5" pour un épisode, "theatrical" / "digital" pour un film)
func (r *Repository) MarkNotified(userID string, mediaType string, tmdbID int, detail string) (bool, error) {
	result, err := r.db.Exec(`
		INSERT INTO push_notifications_sent (user_id, media_type, tmdb_id, detail)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING`, userID, mediaType, tmdbID, detail)
	if err != nil {
		return false, err
	}
	inserted, err := result.RowsAffected()
	return inserted > 0, err
}
