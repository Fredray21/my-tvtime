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
    status_local?: 'watchlist' | 'watched' | 'not_tracked';
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

export const createSearchApi = (api: AxiosInstance) => ({
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