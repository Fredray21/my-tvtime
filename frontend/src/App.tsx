import { createBrowserRouter, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthGate } from './offline/AuthGate';
import { CACHE_BUSTER, OFFLINE_MAX_AGE, queryPersister, shouldPersistQuery } from './offline/persistence';
import { registerOfflineMutations } from './offline/mutations';
import './offline/network';
import { SearchView } from './features/search/SearchView';
import { MovieDetailsView } from './features/movie/MovieDetailsView';
import { ProfileView } from './features/profile/ProfileView';
import { SettingsView } from './features/profile/SettingsView';
import { WatchlistView } from './features/watchlist/WatchlistView';
import { TVDetailsView } from './features/tv/TVDetailsView';
import { PersonDetailsView } from './features/person/PersonDetailsView';
import { WrappedView } from './features/wrapped/WrappedView';
import { SagaDetailsView } from './features/saga/SagaDetailsView';
import { SagasView } from './features/saga/SagasView';
import { MediaGridPage } from './components/MediaGridPage';
import { Clock, Heart } from 'lucide-react';
import { useApi } from './context/ApiContext';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Clerk Publishable Key is missing");
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            // Les données restent en mémoire (et sur l'appareil) assez longtemps pour le mode hors ligne
            gcTime: OFFLINE_MAX_AGE,
        },
    },
});

export const App = () => {
    const api = useApi();

    // Les actions hors ligne doivent être connues avant la restauration du cache (pour rejouer celles en attente)
    useState(() => registerOfflineMutations(queryClient, api.media));
    useEffect(() => {
        registerOfflineMutations(queryClient, api.media);
    }, [api]);

    // On utilise useMemo pour créer le routeur une seule fois 
    // tout en conservant l'accès à ta variable "api"
    const router = useMemo(() => createBrowserRouter([
        {
            element: (
                <>
                    <ScrollRestoration />
                    
                    {/* Connexion Clerk, ou ouverture hors ligne avec le cache si l'utilisateur était déjà connecté */}
                    <AuthGate />
                </>
            ),
            // Les routes enfants qui s'afficheront dans l'Outlet de AppLayout
            children: [
                { path: "/", element: <WatchlistView key={"movie"} mediaType="movie" /> },
                { path: "/tv", element: <WatchlistView key={"tv"} mediaType="tv" /> },
                { path: "/search", element: <SearchView /> },
                { path: "/movie/:id", element: <MovieDetailsView /> },
                { path: "/tv/:id", element: <TVDetailsView /> },
                { path: "/person/:id", element: <PersonDetailsView /> },
                { path: "/wrapped", element: <WrappedView /> },
                { path: "/saga/:id", element: <SagaDetailsView /> },
                { path: "/sagas", element: <SagasView /> },
                { 
                    path: "/favorites/movies", 
                    element: (
                        <MediaGridPage
                            title="Films Coups de cœur"
                            icon={Heart}
                            mediaType="movie"
                            queryKey={['favorites', 'movie', 'grid']}
                            queryFn={() => api.media.getFavorites('movie')}
                            emptyTitle="Aucun coup de cœur"
                            emptyDescription="Tu n'as pas encore ajouté de film à tes favoris."
                        />
                    )
                },
                { 
                    path: "/favorites/tv", 
                    element: (
                        <MediaGridPage
                            title="Séries Coups de cœur"
                            icon={Heart}
                            mediaType="tv"
                            queryKey={['favorites', 'tv', 'grid']}
                            queryFn={() => api.media.getFavorites('tv')}
                            emptyTitle="Aucun coup de cœur"
                            emptyDescription="Tu n'as pas encore ajouté de série à tes favoris."
                        />
                    )
                },
                { 
                    path: "/watched/movies", 
                    element: (
                        <MediaGridPage
                            title="Derniers films vus"
                            icon={Clock}
                            mediaType="movie"
                            queryKey={['latest', 'movie', 'infinite']}
                            queryFn={({ pageParam }) => api.user.getLatestMedias('movie', pageParam)}
                            emptyTitle="Historique vide"
                            emptyDescription="Tu n'as pas encore regardé de film."
                        />
                    )
                },
                { 
                    path: "/watched/tv", 
                    element: (
                        <MediaGridPage
                            title="Dernières séries vues"
                            icon={Clock}
                            mediaType="tv"
                            queryKey={['latest', 'tv', 'infinite']}
                            queryFn={({ pageParam }) => api.user.getLatestMedias('tv', pageParam)}
                            emptyTitle="Historique vide"
                            emptyDescription="Tu n'as pas encore regardé d'épisode."
                        />
                    )
                },
                { path: "/profile", element: <ProfileView /> },
                { path: "/settings", element: <SettingsView /> },
            ]
        }
    ]), [api]);

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister: queryPersister,
                maxAge: OFFLINE_MAX_AGE,
                buster: CACHE_BUSTER,
                dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
            }}
            // Cache restauré : on relance les actions faites hors ligne (elles attendent le réseau si besoin)
            onSuccess={() => queryClient.resumePausedMutations()}
        >
            <RouterProvider router={router} />
        </PersistQueryClientProvider>
    );
};

export default App;