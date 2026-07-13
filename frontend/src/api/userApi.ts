import { type AxiosInstance } from 'axios';
import type { MediaCustomResponse } from './mediaApi';

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

export const createUserApi = (api: AxiosInstance) => ({
    getStats: async (): Promise<UserStatsResponse> => {
        const response = await api.get<UserStatsResponse>('/user/stats');
        return response.data;
    },
    
    getLatestMedias: async (mediaType: 'movie' | 'tv'): Promise<MediaCustomResponse[]> => {
        const response = await api.get<MediaCustomResponse[]>(`/user/${mediaType}s/latest`);
        return response.data;
    },
});