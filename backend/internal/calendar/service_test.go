package calendar

import (
	"reflect"
	"testing"
)

func TestPickFrenchReleases(t *testing.T) {
	cases := []struct {
		name string
		json string
		want []frenchRelease
	}{
		{
			name: "cinéma puis streaming",
			json: `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2026-06-10T00:00:00.000Z","type":4},{"release_date":"2026-02-05T00:00:00.000Z","type":3}]}]}`,
			want: []frenchRelease{{Date: "2026-02-05", Type: "theatrical"}, {Date: "2026-06-10", Type: "digital"}},
		},
		{
			name: "avant-première ignorée, 1ère date de chaque type",
			json: `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2025-05-20T00:00:00.000Z","type":1},{"release_date":"2025-11-19T00:00:00.000Z","type":3},{"release_date":"2025-11-12T00:00:00.000Z","type":2}]}]}`,
			want: []frenchRelease{{Date: "2025-11-12", Type: "theatrical"}},
		},
		{
			name: "sortie directe en streaming",
			json: `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2026-03-01T00:00:00.000Z","type":4}]}]}`,
			want: []frenchRelease{{Date: "2026-03-01", Type: "digital"}},
		},
		{
			name: "seulement DVD et TV : la plus ancienne",
			json: `{"results":[{"iso_3166_1":"FR","release_dates":[{"release_date":"2026-09-01T00:00:00.000Z","type":6},{"release_date":"2026-04-01T00:00:00.000Z","type":5}]}]}`,
			want: []frenchRelease{{Date: "2026-04-01", Type: "physical"}},
		},
		{
			name: "pas de date française",
			json: `{"results":[{"iso_3166_1":"US","release_dates":[{"release_date":"2026-03-01T00:00:00.000Z","type":3}]}]}`,
			want: nil,
		},
		{name: "JSON invalide", json: `pas du json`, want: nil},
	}

	for _, c := range cases {
		got := pickFrenchReleases([]byte(c.json))
		if len(got) == 0 && len(c.want) == 0 {
			continue
		}
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s : obtenu %+v, attendu %+v", c.name, got, c.want)
		}
	}
}

func TestMayHaveLaterFrenchRelease(t *testing.T) {
	if !mayHaveLaterFrenchRelease("2026-08-01", "2026-10-23") {
		t.Error("un film sorti il y a moins d'un an peut encore sortir en France (VOD)")
	}
	if mayHaveLaterFrenchRelease("2020-01-01", "2026-10-23") {
		t.Error("un film sorti en 2020 ne doit plus être vérifié")
	}
	if !mayHaveLaterFrenchRelease("date-invalide", "2026-10-23") {
		t.Error("une date invalide doit être vérifiée par prudence")
	}
}
