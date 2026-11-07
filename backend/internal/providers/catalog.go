package providers

import (
	"encoding/json"
	"regexp"
	"sort"
	"strings"

	"github.com/Fredray21/my-tvtime/internal/tmdb"
)

// CatalogProvider : une plateforme proposée dans les réglages.
// AliasIDs regroupe les variantes d'une même offre (ex : "Netflix" et "Netflix Standard with Ads")
// pour qu'un abonné Netflix voie aussi les titres référencés sous l'offre avec pub.
type CatalogProvider struct {
	ProviderID      int    `json:"provider_id"`
	ProviderName    string `json:"provider_name"`
	LogoPath        string `json:"logo_path"`
	DisplayPriority int    `json:"display_priority"`
	AliasIDs        []int  `json:"alias_ids"`
}

// Suffixes de variantes d'offre : retirés pour retrouver la plateforme "mère"
var variantSuffix = regexp.MustCompile(`(?i)\s+(standard|basic|basique)?\s*(with ads|avec pub(licité)?s?)$`)

func baseName(name string) string {
	return strings.ToLower(strings.TrimSpace(variantSuffix.ReplaceAllString(name, "")))
}

type tmdbCatalogProvider struct {
	ProviderID          int            `json:"provider_id"`
	ProviderName        string         `json:"provider_name"`
	LogoPath            string         `json:"logo_path"`
	DisplayPriorities   map[string]int `json:"display_priorities"`
	DisplayPriorityBase int            `json:"display_priority"`
}

// BuildCatalog fusionne les plateformes films + séries disponibles en France, triées par popularité JustWatch
func BuildCatalog(client *tmdb.Client) ([]CatalogProvider, error) {
	byID := make(map[int]tmdbCatalogProvider)
	for _, mediaType := range []string{"movie", "tv"} {
		body, err := client.GetProviderCatalog(mediaType, Region)
		if err != nil {
			return nil, err
		}
		var data struct {
			Results []tmdbCatalogProvider `json:"results"`
		}
		if err := json.Unmarshal(body, &data); err != nil {
			return nil, err
		}
		for _, p := range data.Results {
			if _, exists := byID[p.ProviderID]; !exists {
				byID[p.ProviderID] = p
			}
		}
	}

	priority := func(p tmdbCatalogProvider) int {
		if v, ok := p.DisplayPriorities[Region]; ok {
			return v
		}
		return p.DisplayPriorityBase
	}

	// Regroupement des variantes sous la plateforme principale (celle dont le nom n'a pas de suffixe)
	groups := make(map[string][]tmdbCatalogProvider)
	for _, p := range byID {
		key := baseName(p.ProviderName)
		groups[key] = append(groups[key], p)
	}

	catalog := make([]CatalogProvider, 0, len(groups))
	for _, members := range groups {
		sort.Slice(members, func(i, j int) bool {
			iVariant := variantSuffix.MatchString(members[i].ProviderName)
			jVariant := variantSuffix.MatchString(members[j].ProviderName)
			if iVariant != jVariant {
				return !iVariant
			}
			return priority(members[i]) < priority(members[j])
		})
		main := members[0]
		entry := CatalogProvider{
			ProviderID:      main.ProviderID,
			ProviderName:    main.ProviderName,
			LogoPath:        main.LogoPath,
			DisplayPriority: priority(main),
			AliasIDs:        make([]int, 0, len(members)-1),
		}
		for _, alias := range members[1:] {
			entry.AliasIDs = append(entry.AliasIDs, alias.ProviderID)
			if p := priority(alias); p < entry.DisplayPriority {
				entry.DisplayPriority = p
			}
		}
		catalog = append(catalog, entry)
	}

	sort.Slice(catalog, func(i, j int) bool {
		if catalog[i].DisplayPriority != catalog[j].DisplayPriority {
			return catalog[i].DisplayPriority < catalog[j].DisplayPriority
		}
		return catalog[i].ProviderName < catalog[j].ProviderName
	})
	return catalog, nil
}

// ExpandWithAliases ajoute aux plateformes choisies leurs variantes (offres avec pub...)
func ExpandWithAliases(selected []int, catalog []CatalogProvider) []int {
	set := make(map[int]bool, len(selected))
	for _, id := range selected {
		set[id] = true
	}
	for _, entry := range catalog {
		if set[entry.ProviderID] {
			for _, alias := range entry.AliasIDs {
				set[alias] = true
			}
		}
	}
	out := make([]int, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	sort.Ints(out)
	return out
}
