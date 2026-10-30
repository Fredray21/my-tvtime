package notification

import (
	"testing"

	"github.com/Fredray21/my-tvtime/internal/calendar"
)

func ep(season, episode int, episodeType string, name string) calendar.CalendarItem {
	return calendar.CalendarItem{
		Type: "episode", ID: 42, Title: "Lupin", PosterPath: "/lupin.jpg",
		SeasonNumber: season, EpisodeNumber: episode, EpisodeType: episodeType,
		EpisodeName: name, IsPremiere: episode == 1,
	}
}

func TestBuildEpisodePayload(t *testing.T) {
	cases := []struct {
		name     string
		episodes []calendar.CalendarItem
		wantBody string
	}{
		{"épisode simple", []calendar.CalendarItem{ep(2, 5, "standard", "Le casse")}, "S2E5 est disponible · Le casse"},
		{"début de saison", []calendar.CalendarItem{ep(3, 1, "standard", "")}, "La saison 3 commence aujourd'hui !"},
		{"final", []calendar.CalendarItem{ep(3, 8, "finale", "")}, "Final de la saison 3 : S3E8 est disponible"},
		{"saison complète", []calendar.CalendarItem{ep(3, 1, "standard", ""), ep(3, 2, "standard", ""), ep(3, 3, "finale", "")}, "La saison 3 complète est disponible (3 épisodes) !"},
		{"plusieurs épisodes", []calendar.CalendarItem{ep(3, 4, "standard", ""), ep(3, 5, "standard", "")}, "2 nouveaux épisodes disponibles (S3E4 → E5)"},
	}

	for _, c := range cases {
		payload := buildEpisodePayload(c.episodes)
		if payload.Body != c.wantBody {
			t.Errorf("%s : obtenu %q, attendu %q", c.name, payload.Body, c.wantBody)
		}
		if payload.Title != "Lupin" || payload.URL != "/tv/42" || payload.Tag != "series-42" {
			t.Errorf("%s : titre/lien/tag inattendus : %+v", c.name, payload)
		}
		if payload.Icon != "https://image.tmdb.org/t/p/w185/lupin.jpg" {
			t.Errorf("%s : icône inattendue : %q", c.name, payload.Icon)
		}
	}
}

func TestBuildMoviePayload(t *testing.T) {
	movie := calendar.CalendarItem{Type: "movie", ID: 7, Title: "Dune : Troisième partie", PosterPath: "/dune.jpg"}

	cases := map[string]string{
		"theatrical": "Sort aujourd'hui au cinéma 🎬",
		"digital":    "Disponible dès aujourd'hui en streaming / VOD 🍿",
		"":           "Sort aujourd'hui !",
	}
	for releaseType, wantBody := range cases {
		movie.ReleaseType = releaseType
		payload := buildMoviePayload(movie)
		if payload.Body != wantBody || payload.URL != "/movie/7" || payload.Tag != "movie-7" {
			t.Errorf("%q : payload inattendu %+v", releaseType, payload)
		}
	}

	// Cinéma et streaming doivent être notifiés séparément
	movie.ReleaseType = "theatrical"
	cinema := releaseKey(movie)
	movie.ReleaseType = "digital"
	if releaseKey(movie) == cinema {
		t.Error("les sorties cinéma et streaming doivent avoir des clés distinctes")
	}
}
