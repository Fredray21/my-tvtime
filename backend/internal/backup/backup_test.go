package backup

import "testing"

func TestParse(t *testing.T) {
	valid := `{"format":"my-tvtime","version":1,"movies":[{"tmdb_id":550,"status":"watched","rating":9}],
		"series":[{"tmdb_id":1396,"status":"finished","episodes":[{"season":1,"episode":1}]}],"platforms":[8]}`
	file, err := Parse([]byte(valid))
	if err != nil {
		t.Fatalf("sauvegarde valide refusée : %v", err)
	}
	if len(file.Movies) != 1 || *file.Movies[0].Rating != 9 || len(file.Series[0].Episodes) != 1 {
		t.Errorf("contenu mal lu : %+v", file)
	}

	invalid := map[string]string{
		"pas du JSON":     `nope`,
		"autre format":    `{"format":"trakt","version":1}`,
		"version future":  `{"format":"my-tvtime","version":99}`,
		"statut inconnu":  `{"format":"my-tvtime","version":1,"movies":[{"tmdb_id":1,"status":"seen"}]}`,
		"note hors borne": `{"format":"my-tvtime","version":1,"movies":[{"tmdb_id":1,"status":"watched","rating":11}]}`,
		"épisode 0":       `{"format":"my-tvtime","version":1,"series":[{"tmdb_id":1,"status":"watching","episodes":[{"season":1,"episode":0}]}]}`,
	}
	for name, data := range invalid {
		if _, err := Parse([]byte(data)); err == nil {
			t.Errorf("%s : aurait dû être refusé", name)
		}
	}
}
