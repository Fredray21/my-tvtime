import { type AxiosInstance } from 'axios';

export interface Genre {
    id: number;
    name: string;
}

export interface ProductionCompany {
    id: number;
    name: string;
    logo_path: string | null;
}

// --- 2. LE TYPE HYBRIDE (FILM & SÉRIE) ---
export interface TMDBMediaResult {
    id: number;

    // Spécifique aux Films
    title?: string;
    original_title?: string;
    release_date?: string;
    runtime?: number;
    budget?: number;
    revenue?: number;

    // Spécifique aux Séries (TV)
    name?: string;
    original_name?: string;
    first_air_date?: string;
    episode_run_time?: number[];

    // Communs aux deux
    poster_path: string | null;
    backdrop_path?: string | null;
    overview?: string;
    vote_average?: number;
    tagline?: string;
    genres?: Genre[];
    production_companies?: ProductionCompany[];
    status?: string;
}

// --- 3. NOS TYPES LOCAUX (AVEC BDD) ---
export interface MediaCustomResponse extends TMDBMediaResult {
    status_local: 'watchlist' | 'watched' | 'not_tracked';
    is_favorite: boolean;
    rewatch_count: number;
}

export interface WatchlistPaginatedResponse {
    page: number;
    results: MediaCustomResponse[];
    has_next_page: boolean;
}

export interface UpdateStatusDTO {
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    status_local: 'watchlist' | 'watched' | 'not_tracked';
    is_favorite: boolean;
    rewatch_count: number;
}


export const createMediaApi = (api: AxiosInstance) => ({
    getWatchlist: async (page: number = 1, mediaType: 'movie' | 'tv' = 'movie'): Promise<WatchlistPaginatedResponse> => {
        // Si mediaType est 'movie', ça tape '/movies/watchlist?page=...'
        // Si mediaType est 'tv', ça tape '/tv/watchlist?page=...'
        const response = await api.get<WatchlistPaginatedResponse>(`/${mediaType}s/watchlist?page=${page}`);
        return response.data;
    },

    updateStatus: async (data: UpdateStatusDTO) => {
        return api.post(`/${data.media_type}s/status`, data);
    },

    removeMedia: async (id: number, mediaType: 'movie' | 'tv') => {
        return api.delete(`/${mediaType}s/${id}`);
    },

    getMediaDetails: async (id: number, mediaType: 'movie' | 'tv'): Promise<MediaCustomResponse> => {
        const response = await api.get<MediaCustomResponse>(`/${mediaType}s/${id}`);
        return response.data;
    },

    getFavorites: async (mediaType: 'movie' | 'tv'): Promise<MediaCustomResponse[]> => {
        const response = await api.get<MediaCustomResponse[]>(`/${mediaType}s/favorites`);
        return response.data;
    },

    getSimilar: async (id: number, mediaType: 'movie' | 'tv'): Promise<MediaCustomResponse[]> => {
        const response = await api.get<MediaCustomResponse[]>(`/${mediaType}s/${id}/similar`);
        return response.data;
    },

});