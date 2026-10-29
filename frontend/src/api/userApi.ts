import { type AxiosInstance } from 'axios';
import type { MediaCustomResponse } from './mediaApi';
import type { ImportAnalysisResponse } from '../components/TVTimeImport';

export interface UserStatsResponse {
    movies: {
        total_watched: number;
        total_runtime_minutes: number;
    };
    tv: {
        total_episodes_watched: number;
        total_runtime_minutes: number;
    };
}

// --- WRAPPED (RÉCAP ANNUEL) ---
export interface WrappedTitle {
    id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    is_favorite: boolean;
    watched_at?: string;
}

export interface WrappedSeries extends WrappedTitle {
    episodes: number;
    minutes: number;
}

export interface WrappedDay {
    date: string;
    minutes: number;
    movies: number;
    episodes: number;
}

export interface WrappedResponse {
    year: number;
    available_years: number[];
    total_minutes: number;
    movie_minutes: number;
    tv_minutes: number;
    movies_count: number;
    rewatch_count: number;
    episodes_count: number;
    series_count: number;
    new_series: number;
    active_days: number;
    monthly: { month: number; minutes: number; movies: number; episodes: number }[];
    weekdays: number[]; // minutes, lundi en premier
    top_series: WrappedSeries[];
    highlight_movies: WrappedTitle[];
    top_genres: { name: string; count: number }[];
    top_actors: { id: number; name: string; profile_path: string; count: number; titles: string[] }[];
    first_movie: WrappedTitle | null;
    last_movie: WrappedTitle | null;
    busiest_day: WrappedDay | null;
    biggest_binge: { date: string; episodes: number; series: WrappedTitle } | null;
    longest_streak: number;
    backfill_days: number;
}

export const createUserApi = (api: AxiosInstance) => ({
    getWrapped: async (year?: number): Promise<WrappedResponse> => {
        const response = await api.get<WrappedResponse>('/user/wrapped', { params: year ? { year } : {} });
        return response.data;
    },

    getStats: async (): Promise<UserStatsResponse> => {
        const response = await api.get<UserStatsResponse>('/user/stats');
        return response.data;
    },

    getLatestMedias: async (mediaType: 'movie' | 'tv', page: number): Promise<{ results: MediaCustomResponse[], page: number, has_next_page: boolean }> => {
        const { data } = await api.get(`/user/${mediaType}s/latest`, {
            params: { page, limit: 20 }
        });
        return data;
    },

    analyzeTVTime: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const { data } = await api.post<{ task_id: string; message: string }>(
            '/import/tvtime/upload',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return data;
    },

    getImportStatus: async (taskId: string) => {
        const { data } = await api.get(`/import/tvtime/status/${taskId}`);
        return data;
    },

    confirmTVTimeImport: async (analysisResult: ImportAnalysisResponse) => {
        const { data } = await api.post<{ message: string, task_id: string }>(
            '/import/tvtime/confirm',
            analysisResult
        );
        return data;
    },
});