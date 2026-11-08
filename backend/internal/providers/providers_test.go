package providers

import (
	"encoding/json"
	"testing"
)

func TestStreamingKeepsOnlyFranceIncludedOffers(t *testing.T) {
	raw := `{"results":{
		"FR":{"flatrate":[{"provider_id":8,"provider_name":"Netflix"}],
		      "ads":[{"provider_id":1796,"provider_name":"Netflix Standard with Ads"},{"provider_id":8,"provider_name":"Netflix"}],
		      "rent":[{"provider_id":2,"provider_name":"Apple TV"}]},
		"US":{"flatrate":[{"provider_id":15,"provider_name":"Hulu"}]}}}`

	var s Streaming
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		t.Fatal(err)
	}
	if len(s) != 2 || s[0].ProviderID != 8 || s[1].ProviderID != 1796 {
		t.Fatalf("attendu Netflix + Netflix avec pub (sans doublon ni location), obtenu %+v", s)
	}
}

func TestStreamingWithoutFrance(t *testing.T) {
	var s Streaming
	if err := json.Unmarshal([]byte(`{"results":{"US":{"flatrate":[{"provider_id":15}]}}}`), &s); err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Fatalf("attendu aucune plateforme, obtenu %+v", s)
	}
}

func TestBaseNameGroupsAdTiers(t *testing.T) {
	cases := map[string]string{
		"Netflix":                          "netflix",
		"Netflix Standard with Ads":        "netflix",
		"Netflix basic with Ads":           "netflix",
		"Amazon Prime Video with Ads":      "amazon prime video",
		"Disney Plus":                      "disney plus",
		"Paramount Plus Apple TV Channel ": "paramount plus apple tv channel",
	}
	for in, want := range cases {
		if got := baseName(in); got != want {
			t.Errorf("baseName(%q) = %q, attendu %q", in, got, want)
		}
	}
}

func TestExpandWithAliases(t *testing.T) {
	catalog := []CatalogProvider{
		{ProviderID: 8, AliasIDs: []int{1796}},
		{ProviderID: 119, AliasIDs: []int{2100}},
	}
	got := ExpandWithAliases([]int{8}, catalog)
	if len(got) != 2 || got[0] != 8 || got[1] != 1796 {
		t.Fatalf("attendu [8 1796], obtenu %v", got)
	}
}
