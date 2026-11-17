package user

import "testing"

func TestIsBackfillDay(t *testing.T) {
	cases := []struct {
		day  WrappedDay
		want bool
	}{
		{WrappedDay{Minutes: 0}, false},
		{WrappedDay{Minutes: 8 * 60, Episodes: 12}, false},
		{WrappedDay{Minutes: 16 * 60}, false},
		{WrappedDay{Minutes: 16*60 + 1}, true},
		{WrappedDay{Minutes: 6 * 60, Movies: 3}, false},
		{WrappedDay{Minutes: 0, Movies: 7}, true}, // films sans durée connue mais saisis en masse
	}
	for _, c := range cases {
		if got := isBackfillDay(c.day); got != c.want {
			t.Errorf("isBackfillDay(%+v) = %v, attendu %v", c.day, got, c.want)
		}
	}
}

func TestLongestStreak(t *testing.T) {
	cases := []struct {
		days []string
		want int
	}{
		{nil, 0},
		{[]string{"2025-03-01"}, 1},
		{[]string{"2025-03-03", "2025-03-01", "2025-03-02"}, 3}, // ordre quelconque
		{[]string{"2025-03-01", "2025-03-02", "2025-03-05", "2025-03-06", "2025-03-07"}, 3},
		{[]string{"2024-12-31", "2025-01-01"}, 2},
		{[]string{"2025-03-29", "2025-03-30", "2025-03-31"}, 3}, // passage à l'heure d'été
	}
	for _, c := range cases {
		if got := longestStreak(c.days); got != c.want {
			t.Errorf("longestStreak(%v) = %d, attendu %d", c.days, got, c.want)
		}
	}
}

func TestTopRated(t *testing.T) {
	r := func(v int) *int { return &v }
	titles := []WrappedTitle{
		{ID: 1, UserRating: r(6), VoteAverage: 9},
		{ID: 2, UserRating: r(9), VoteAverage: 5},
		{ID: 3, UserRating: r(9), VoteAverage: 8},
		{ID: 4, UserRating: r(3)},
	}
	top, avg := topRated(titles, 3)
	if avg != 6.8 { // 27 / 4 = 6.75 -> 6.8
		t.Errorf("moyenne = %v, attendu 6.8", avg)
	}
	if len(top) != 3 || top[0].ID != 3 || top[1].ID != 2 || top[2].ID != 1 {
		t.Errorf("ordre inattendu : %+v", top)
	}
	if top, avg := topRated(nil, 3); len(top) != 0 || avg != 0 {
		t.Errorf("liste vide : %+v, %v", top, avg)
	}
}
