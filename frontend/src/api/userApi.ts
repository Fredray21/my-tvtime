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

export const createUserApi = (api: AxiosInstance) => ({
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