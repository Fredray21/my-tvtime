import React, { createContext, useContext, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { createSearchApi } from '../api/searchApi';
import { createMediaApi } from '../api/mediaApi';
import { createUserApi } from '../api/userApi';
// import { createTvApi } from '../api/tvApi'; // Prêt pour le futur !

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

interface ApiContextType {
    search: ReturnType<typeof createSearchApi>;
    media: ReturnType<typeof createMediaApi>;
        user: ReturnType<typeof createUserApi>;
}

const ApiContext = createContext<ApiContextType | null>(null);

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { getToken } = useAuth();

    const apiServices = useMemo(() => {
        const axiosInstance = axios.create({
            baseURL: API_URL,
            headers: { 'Content-Type': 'application/json' },
        });

        axiosInstance.interceptors.request.use(async (config) => {
            try {
                const token = await getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (err) {
                console.error("Erreur intercepteur ApiContext", err);
            }
            return config;
        });

        return {
            search: createSearchApi(axiosInstance),
            media: createMediaApi(axiosInstance),
            user: createUserApi(axiosInstance)
        };
    }, [getToken]);

    return (
        <ApiContext.Provider value={apiServices}>
            {children}
        </ApiContext.Provider>
    );
};

export const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error("useApi doit être utilisé à l'intérieur d'un ApiProvider");
    }
    return context;
};