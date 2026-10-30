package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
	_ "time/tzdata" // L'image alpine n'embarque pas les fuseaux horaires

	"github.com/Fredray21/my-tvtime/internal/calendar"
	webpush "github.com/SherClockHolmes/webpush-go"
)

// Vérification des nouveaux épisodes toutes les 30 min, uniquement en journée (heure de Paris)
const (
	checkInterval = 30 * time.Minute
	quietHourEnd  = 9  // pas de notification avant 9h
	quietHourFrom = 22 // ni après 22h
)

// Payload : ce que le service worker (push-sw.js) reçoit et affiche
type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Icon  string `json:"icon,omitempty"`
	Tag   string `json:"tag,omitempty"`
}

type Service struct {
	repo       *Repository
	calendar   *calendar.Service
	publicKey  string
	privateKey string
	subject    string
	paris      *time.Location
}

func NewService(repo *Repository, calendarSvc *calendar.Service, publicKey, privateKey, subject string) *Service {
	paris, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		paris = time.UTC
	}
	return &Service{repo: repo, calendar: calendarSvc, publicKey: publicKey, privateKey: privateKey, subject: subject, paris: paris}
}

// Enabled : sans clés VAPID (secrets non configurés), les notifications sont simplement désactivées
func (s *Service) Enabled() bool {
	return s.publicKey != "" && s.privateKey != ""
}

func (s *Service) PublicKey() string {
	return s.publicKey
}

func (s *Service) Subscribe(sub Subscription) error {
	return s.repo.SaveSubscription(sub)
}

func (s *Service) Unsubscribe(userID, endpoint string) error {
	return s.repo.DeleteUserSubscription(userID, endpoint)
}

// SendToUser envoie une notification à tous les appareils de l'utilisateur et renvoie le nombre d'envois réussis
func (s *Service) SendToUser(userID string, payload Payload) (int, error) {
	if !s.Enabled() {
		return 0, fmt.Errorf("notifications désactivées (clés VAPID manquantes)")
	}

	subs, err := s.repo.GetSubscriptions(userID)
	if err != nil {
		return 0, err
	}

	message, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}

	sent := 0
	for _, sub := range subs {
		resp, err := webpush.SendNotification(message, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      s.subject,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             60 * 60 * 24, // le service de push garde le message 24h si l'appareil est éteint
			Urgency:         webpush.UrgencyNormal,
		})
		if err != nil {
			log.Printf("Push : échec d'envoi à %s : %v", userID, err)
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		switch {
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusForbidden:
			// Abonnement expiré, désinstallé ou créé avec d'anciennes clés : l'app se réabonnera à la prochaine ouverture
			s.repo.DeleteSubscription(sub.Endpoint)
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			sent++
		default:
			log.Printf("Push : réponse inattendue %d pour %s", resp.StatusCode, userID)
		}
	}

	return sent, nil
}

// RunScheduler vérifie régulièrement les épisodes sortis aujourd'hui et prévient les utilisateurs abonnés
func (s *Service) RunScheduler(ctx context.Context) {
	if !s.Enabled() {
		log.Println("Push : clés VAPID absentes, notifications désactivées")
		return
	}
	log.Println("Push : planificateur des nouveaux épisodes démarré")

	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	for {
		hour := time.Now().In(s.paris).Hour()
		if hour >= quietHourEnd && hour < quietHourFrom {
			s.notifyNewEpisodes()
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) notifyNewEpisodes() {
	users, err := s.repo.GetSubscribedUsers()
	if err != nil {
		log.Printf("Push : impossible de lister les abonnés : %v", err)
		return
	}

	for _, userID := range users {
		if err := s.notifyUser(userID); err != nil {
			log.Printf("Push : erreur pour %s : %v", userID, err)
		}
	}
}

func (s *Service) notifyUser(userID string) error {
	// Calendrier (séries suivies + films de la watchlist) jusqu'à aujourd'hui inclus
	cal, err := s.calendar.GetCalendar(userID, "", 0)
	if err != nil {
		return err
	}

	for _, day := range cal.Days {
		if day.Date != cal.Today {
			continue
		}

		// Une notification par série, même si plusieurs épisodes sortent d'un coup
		bySeries := make(map[int][]calendar.CalendarItem)
		order := make([]int, 0)
		for _, item := range day.Items {
			switch item.Type {
			case "movie":
				// Sortie au cinéma ou en streaming / VOD d'un film de la watchlist
				isNew, err := s.repo.MarkNotified(userID, "movie", item.ID, releaseKey(item))
				if err != nil {
					return err
				}
				if isNew {
					if _, err := s.SendToUser(userID, buildMoviePayload(item)); err != nil {
						return err
					}
				}

			case "episode":
				if item.IsWatched {
					continue
				}
				detail := fmt.Sprintf("S%dE%d", item.SeasonNumber, item.EpisodeNumber)
				isNew, err := s.repo.MarkNotified(userID, "tv", item.ID, detail)
				if err != nil {
					return err
				}
				if !isNew {
					continue
				}
				if _, exists := bySeries[item.ID]; !exists {
					order = append(order, item.ID)
				}
				bySeries[item.ID] = append(bySeries[item.ID], item)
			}
		}

		for _, seriesID := range order {
			if _, err := s.SendToUser(userID, buildEpisodePayload(bySeries[seriesID])); err != nil {
				return err
			}
		}
	}
	return nil
}

// releaseKey distingue la sortie cinéma de la sortie streaming d'un même film
func releaseKey(item calendar.CalendarItem) string {
	if item.ReleaseType == "" {
		return "release"
	}
	return item.ReleaseType
}

func buildMoviePayload(movie calendar.CalendarItem) Payload {
	payload := Payload{
		Title: movie.Title,
		URL:   fmt.Sprintf("/movie/%d", movie.ID),
		Tag:   fmt.Sprintf("movie-%d", movie.ID),
	}
	if movie.PosterPath != "" {
		payload.Icon = "https://image.tmdb.org/t/p/w185" + movie.PosterPath
	}

	switch movie.ReleaseType {
	case "theatrical":
		payload.Body = "Sort aujourd'hui au cinéma 🎬"
	case "digital":
		payload.Body = "Disponible dès aujourd'hui en streaming / VOD 🍿"
	case "physical":
		payload.Body = "Sort aujourd'hui en DVD / Blu-ray"
	case "tv":
		payload.Body = "Diffusé aujourd'hui à la télé 📺"
	default:
		payload.Body = "Sort aujourd'hui !"
	}
	return payload
}

func buildEpisodePayload(episodes []calendar.CalendarItem) Payload {
	first := episodes[0]
	last := episodes[len(episodes)-1]

	payload := Payload{
		Title: first.Title,
		URL:   fmt.Sprintf("/tv/%d", first.ID),
		Tag:   fmt.Sprintf("series-%d", first.ID),
	}
	if first.PosterPath != "" {
		payload.Icon = "https://image.tmdb.org/t/p/w185" + first.PosterPath
	}

	hasFinale := false
	for _, ep := range episodes {
		if ep.EpisodeType == "finale" {
			hasFinale = true
		}
	}

	switch {
	case len(episodes) == 1 && first.IsPremiere:
		payload.Body = fmt.Sprintf("La saison %d commence aujourd'hui !", first.SeasonNumber)
	case len(episodes) == 1 && hasFinale:
		payload.Body = fmt.Sprintf("Final de la saison %d : S%dE%d est disponible", first.SeasonNumber, first.SeasonNumber, first.EpisodeNumber)
	case len(episodes) == 1:
		payload.Body = fmt.Sprintf("S%dE%d est disponible", first.SeasonNumber, first.EpisodeNumber)
		if first.EpisodeName != "" {
			payload.Body += " · " + first.EpisodeName
		}
	case first.IsPremiere && hasFinale:
		payload.Body = fmt.Sprintf("La saison %d complète est disponible (%d épisodes) !", first.SeasonNumber, len(episodes))
	default:
		payload.Body = fmt.Sprintf("%d nouveaux épisodes disponibles (S%dE%d → E%d)", len(episodes), first.SeasonNumber, first.EpisodeNumber, last.EpisodeNumber)
	}

	return payload
}
