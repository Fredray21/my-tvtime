import { type AxiosInstance } from 'axios';

// Interfaces de base pour harmoniser le Front et ton BFF Go
export interface SearchResultBase {
    id: number;
    title?: string;       // Films / Acteurs
    name?: string;        // Séries / Acteurs
    poster_path?: string; // Films / Séries
    profile_path?: string;// Acteurs
    release_date?: string;// Films
    first_air_date?: string; // Séries
    vote_average?: number;   // Films / Séries
    media_type: 'movie' | 'tv' | 'person';
    status_local?: 'watchlist' | 'watched' | 'watching' | 'pending' | 'finished' | 'not_tracked';
    is_favorite?: boolean;
}

export interface MultiSearchResponse {
    movies: SearchResultBase[];
    tvShows: SearchResultBase[];
    actors: SearchResultBase[];
}

export interface PagedSearchResponse {
    results: SearchResultBase[];
    page: number;
    total_pages: number;
}

// --- DÉCOUVERTE (tendances, au cinéma, populaires...) ---
// my_platforms : populaires sur les plateformes choisies dans "Mes plateformes"
export type DiscoverMovieList = 'trending' | 'now_playing' | 'upcoming' | 'popular' | 'top_rated' | 'my_platforms';
export type DiscoverTvList = 'trending' | 'popular' | 'on_the_air' | 'top_rated' | 'my_platforms';
export type DiscoverList = DiscoverMovieList | DiscoverTvList;

export interface DiscoverItem extends SearchResultBase {
    backdrop_path?: string | null;
    overview?: string;
}

export interface DiscoverResponse {
    results: DiscoverItem[];
    page: number;
    total_pages: number;
    has_next_page: boolean;
}

export const createSearchApi = (api: AxiosInstance) => ({
    /**
     * Listes de découverte TMDB, enrichies du statut de l'utilisateur
     */
    getDiscoverList: async (mediaType: 'movie' | 'tv', list: DiscoverList, page = 1): Promise<DiscoverResponse> => {
        const response = await api.get<DiscoverResponse>(`/discover/${mediaType}/${list}`, { params: { page } });
        return response.data;
    },

    /**
     * Onglet "Tout" : Recherche globale (BFF fusionne les carrousels)
     */
    searchMulti: async (query: string): Promise<MultiSearchResponse> => {
        const response = await api.get<MultiSearchResponse>('/search/multi', { params: { q: query } });
        return response.data;
    },

    /**
     * Onglets Spécifiques : Recherche paginée
     */
    searchPaged: async (type: 'movie' | 'tv' | 'person', query: string, page: number): Promise<PagedSearchResponse> => {
        const response = await api.get<PagedSearchResponse>(`/search/${type}`, {
            params: { q: query, page },
        });
        return response.data;
    },
});