import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AppLayout } from './components/AppLayout';
import { SearchView } from './features/search/SearchView';
import { MovieDetailsView } from './features/movie/MovieDetailsView';
import { ProfileView } from './features/profile/ProfileView';
import { WatchedView } from './features/watched/WatchedView';
import { WatchlistView } from './features/watchlist/WatchlistView';

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
    return (
        // 2. On englobe toute l'app avec le ClerkProvider
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

                            <Route path='/watched/movies' element={<WatchedView mediaType={'movie'} />} />
                            <Route path='/watched/tv' element={<WatchedView mediaType={'tv'} />} />

                            <Route path="/profile" element={<ProfileView />} />
                        </Route>
                    </Routes>
                </SignedIn>

            </BrowserRouter>
        </QueryClientProvider>
    );
};

export default App;