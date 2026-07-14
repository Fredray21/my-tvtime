import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AppLayout } from './components/AppLayout';
import { SearchView } from './features/search/SearchView';
import { MovieDetailsView } from './features/movie/MovieDetailsView';
import { ProfileView } from './features/profile/ProfileView';
import { WatchlistView } from './features/watchlist/WatchlistView';
import { TVDetailsView } from './features/tv/TVDetailsView';
import { MediaGridPage } from './components/MediaGridPage';
import { Clock, Heart } from 'lucide-react';
import { useApi } from './context/ApiContext';

// 1. Récupération de la clé Clerk depuis les variables d'environnement Vite
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Clerk Publishable Key is missing");
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});


export const App = () => {
    const api = useApi();

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>

                {/* 3. Ce bloc ne s'affiche QUE si l'utilisateur est DÉCONNECTÉ */}
                <SignedOut>
                    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                        {/* Tu pourras glisser ton logo ici plus tard ! */}
                        <SignIn routing="hash" />
                    </div>
                </SignedOut>

                {/* 4. Ce bloc ne s'affiche QUE si l'utilisateur est CONNECTÉ */}
                <SignedIn>
                    <Routes>
                        <Route element={<AppLayout />}>
                            {/* Les pages qui auront la Bottom Navbar */}
                            <Route path="/" element={<WatchlistView mediaType="movie" />} />
                            <Route path="/tv" element={<WatchlistView mediaType="tv" />} />

                            <Route path="/search" element={<SearchView />} />

                            <Route path="/movie/:id" element={<MovieDetailsView />} />
                            <Route path="/tv/:id" element={<TVDetailsView />} />

                            <Route path="/favorites/movies" element={
                                <MediaGridPage
                                    title="Films Coups de cœur"
                                    icon={Heart}
                                    mediaType="movie"
                                    queryKey={['favorites', 'movie', 'grid']}
                                    queryFn={() => api.media.getFavorites('movie')}
                                    emptyTitle="Aucun coup de cœur"
                                    emptyDescription="Tu n'as pas encore ajouté de film à tes favoris."
                                />
                            } />

                            <Route path="/favorites/tv" element={
                                <MediaGridPage
                                    title="Séries Coups de cœur"
                                    icon={Heart}
                                    mediaType="tv"
                                    queryKey={['favorites', 'tv', 'grid']}
                                    queryFn={() => api.media.getFavorites('tv')}
                                    emptyTitle="Aucun coup de cœur"
                                    emptyDescription="Tu n'as pas encore ajouté de série à tes favoris."
                                />
                            } />

                            {/* --- ROUTES HISTORIQUE (LATEST) --- */}
                            <Route path="/watched/movies" element={
                                <MediaGridPage
                                    title="Derniers films vus"
                                    icon={Clock}
                                    mediaType="movie"
                                    queryKey={['latest', 'movie', 'infinite']}
                                    queryFn={({ pageParam }) => api.user.getLatestMedias('movie', pageParam)}
                                    emptyTitle="Historique vide"
                                    emptyDescription="Tu n'as pas encore regardé de film."
                                />
                            } />

                            <Route path="/watched/tv" element={
                                <MediaGridPage
                                    title="Dernières séries vues"
                                    icon={Clock}
                                    mediaType="tv"
                                    queryKey={['latest', 'tv', 'infinite']}
                                    queryFn={({ pageParam }) => api.user.getLatestMedias('tv', pageParam)}
                                    emptyTitle="Historique vide"
                                    emptyDescription="Tu n'as pas encore regardé d'épisode."
                                />
                            } />

                            <Route path="/profile" element={<ProfileView />} />
                        </Route>
                    </Routes>
                </SignedIn>

            </BrowserRouter>
        </QueryClientProvider>
    );
};

export default App;