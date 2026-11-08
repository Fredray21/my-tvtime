package providers

import "encoding/json"

// Region : pays utilisé pour les disponibilités (données JustWatch via TMDB)
const Region = "FR"

// Streaming : plateformes où un titre est inclus (abonnement, gratuit, avec pub) en France.
// Se décode directement depuis le bloc "watch/providers" ajouté aux détails TMDB (append_to_response),
// en ne gardant que la France : on ne transporte pas les ~150 pays jusqu'au front.
type Streaming []Provider

func (s *Streaming) UnmarshalJSON(data []byte) error {
	var raw struct {
		Results map[string]RegionProviders `json:"results"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	region, ok := raw.Results[Region]
	if !ok {
		*s = nil
		return nil
	}

	seen := make(map[int]bool)
	out := make(Streaming, 0, len(region.Flatrate)+len(region.Free)+len(region.Ads))
	for _, group := range [][]Provider{region.Flatrate, region.Free, region.Ads} {
		for _, p := range group {
			if !seen[p.ProviderID] {
				seen[p.ProviderID] = true
				out = append(out, p)
			}
		}
	}
	*s = out
	return nil
}

// MarshalJSON : simple tableau de plateformes
func (s Streaming) MarshalJSON() ([]byte, error) {
	if s == nil {
		return []byte("[]"), nil
	}
	return json.Marshal([]Provider(s))
}
