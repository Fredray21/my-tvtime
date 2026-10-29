package calendar

import "testing"

func TestPickFrenchRelease(t *testing.T) {
	cases := []struct {
		name     string
		json     string
		wantDate string
		wantType string
		wantOK   bool
	}{
		{
			name:     "cinéma prioritaire sur la VOD même plus tardive",
			json:     `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2026-01-10T00:00:00.000Z","type":4},{"release_date":"2026-02-05T00:00:00.000Z","type":3}]}]}`,
			wantDate: "2026-02-05", wantType: "theatrical", wantOK: true,
		},
		{
			name:     "avant-première ignorée",
			json:     `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2025-05-20T00:00:00.000Z","type":1},{"release_date":"2025-11-12T00:00:00.000Z","type":3}]}]}`,
			wantDate: "2025-11-12", wantType: "theatrical", wantOK: true,
		},
		{
			name:     "sortie directe en streaming",
			json:     `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2026-03-01T00:00:00.000Z","type":4}]}]}`,
			wantDate: "2026-03-01", wantType: "digital", wantOK: true,
		},
		{
			name:   "pas de date française",
			json:   `{"results":[{"iso_3166_1":"US","release_dates":[{"release_date":"2026-03-01T00:00:00.000Z","type":3}]}]}`,
			wantOK: false,
		},
		{name: "JSON invalide", json: `pas du json`, wantOK: false},
	}

	for _, c := range cases {
		date, releaseType, ok := pickFrenchRelease([]byte(c.json))
		if ok != c.wantOK || date != c.wantDate || releaseType != c.wantType {
			t.Errorf("%s : obtenu (%q, %q, %v), attendu (%q, %q, %v)", c.name, date, releaseType, ok, c.wantDate, c.wantType, c.wantOK)
		}
	}
}

func TestMayHaveLaterFrenchRelease(t *testing.T) {
	if !mayHaveLaterFrenchRelease("2026-08-01", "2026-10-23") {
		t.Error("un film sorti il y a moins de 6 mois peut encore sortir en France")
	}
	if mayHaveLaterFrenchRelease("2020-01-01", "2026-10-23") {
		t.Error("un film sorti en 2020 ne doit plus être vérifié")
	}
	if !mayHaveLaterFrenchRelease("date-invalide", "2026-10-23") {
		t.Error("une date invalide doit être vérifiée par prudence")
	}
}
