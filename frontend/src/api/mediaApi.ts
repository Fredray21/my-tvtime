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

export interface TMDBSeasonShort {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    vote_average: number;

    //custom data
    watched_count: number;
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
    number_of_episodes?: number;
    number_of_seasons?: number;
    seasons?: TMDBSeasonShort[];

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
    status_local: UpdateStatusDTO['status_local'];
    is_favorite: boolean;
    rewatch_count: number;
    media_type?: 'movie' | 'tv';
    created_at?: string;
    updated_at?: string;
    
    next_season_number?: number;
    next_episode_number?: number;
}

export interface WatchlistPaginatedResponse {
    page: number;
    results: MediaCustomResponse[];
    has_next_page: boolean;
}

// status_local TV : 'watchlist' | 'watching' | 'finished' | 'pending' | 'watched' | 'not_tracked'
// status_local Movie : 'watchlist' | 'watched' | 'not_tracked'
export interface UpdateStatusDTO {
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    status_local: 'watchlist' | 'watching' | 'finished' | 'pending' | 'watched' | 'not_tracked';
    is_favorite: boolean;
    rewatch_count: number;
}

// --- NOUVEAUX TYPES SPECIFIQUES SÉRIES & ÉPISODES ---
export interface TMDBEpisodeShort {
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    runtime: number;
    still_path: string | null;
    air_date: string;
    vote_average: number;
}

export interface TMDBSeasonDetail {
    id: number;
    name: string;
    season_number: number;
    overview: string;
    air_date: string;
    poster_path: string | null;
    episodes: TMDBEpisodeShort[];
}

export interface EpisodeCustomResponse extends TMDBEpisodeShort {
    is_watched: boolean;
    rewatch_count: number;
}

export interface SeasonCustomResponse {
    id: number;
    name: string;
    season_number: number;
    overview: string;
    air_date: string;
    poster_path: string | null;
    vote_average: number;
    episodes: EpisodeCustomResponse[];
}

export const createMediaApi = (api: AxiosInstance) => ({
    getWatchlist: async (page: number, mediaType: 'movie' | 'tv') => {
        const response = await api.get(`/${mediaType}s/watchlist?page=${page}`);
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

    // --- TV ---
    // 1. Pour récupérer la liste des épisodes d'une saison spécifique
    getSeasonDetails: async (seriesId: number, seasonNumber: number): Promise<SeasonCustomResponse> => {
        const response = await api.get<SeasonCustomResponse>(`/tvs/${seriesId}/season/${seasonNumber}`);
        return response.data;
    },

    // 2. Pour marquer un épisode comme vu (POST)
    watchEpisode: async (seriesId: number, seasonNumber: number, episodeNumber: number) => {
        return api.post(`/tvs/watch`, {
            tmdb_id: seriesId,
            season_number: seasonNumber,
            episode_number: episodeNumber
        });
    },

    // 3. Pour retirer un épisode de l'historique (DELETE)
    removeEpisode: async (seriesId: number, seasonNumber: number, episodeNumber: number) => {
        return api.delete(`/tvs/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`);
    },

    // 4. Pour récupérer les recommandations de séries
    getSimilarSeries: async (seriesId: number): Promise<MediaCustomResponse[]> => {
        const response = await api.get<{ results: MediaCustomResponse[] }>(`/tvs/${seriesId}/similar`);
        return response.data.results;
    },

    // 5. Pour faire -1 sur un épisode (PUT)
    decrementEpisode: async (seriesId: number, seasonNumber: number, episodeNumber: number) => {
        return api.put(`/tvs/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/decrement`);
    },

    watchAllEpisodesInSeason: async (seriesId: number, seasonNumber: number) => {
        return api.post(`/tvs/watchAll`, {
            tmdb_id: seriesId,
            season_number: seasonNumber
        });
    },

    getUpcomingMovies: async (page: number): Promise<WatchlistPaginatedResponse> => {
        const response = await api.get(`/movies/upcoming?page=${page}`);
        return response.data;
    },

    getUpcomingSeries: async (page: number): Promise<WatchlistPaginatedResponse> => {
        const response = await api.get(`/tvs/upcoming?page=${page}`);
        return response.data;
    }
});