import type { DiscoverList } from '../../api/searchApi';

export interface DiscoverListDef {
    mediaType: 'movie' | 'tv';
    list: DiscoverList;
    title: string;
    // Classement affiché avec de grands numéros (Top 10)
    ranked?: boolean;
}

// Rangées de la page Découvrir, dans l'ordre d'affichage
export const DISCOVER_LISTS: DiscoverListDef[] = [
    { mediaType: 'movie', list: 'trending', title: 'Films tendance de la semaine', ranked: true },
    { mediaType: 'tv', list: 'trending', title: 'Séries tendance de la semaine', ranked: true },
    { mediaType: 'movie', list: 'now_playing', title: 'En ce moment au cinéma' },
    { mediaType: 'movie', list: 'upcoming', title: 'Bientôt au cinéma' },
    { mediaType: 'tv', list: 'on_the_air', title: 'Nouveaux épisodes cette semaine' },
    { mediaType: 'movie', list: 'popular', title: 'Films populaires' },
    { mediaType: 'tv', list: 'popular', title: 'Séries populaires' },
    { mediaType: 'movie', list: 'top_rated', title: 'Films les mieux notés' },
    { mediaType: 'tv', list: 'top_rated', title: 'Séries les mieux notées' },
];

export const findDiscoverList = (mediaType?: string, list?: string) =>
    DISCOVER_LISTS.find(def => def.mediaType === mediaType && def.list === list);
