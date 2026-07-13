import { useUser, useClerk } from '@clerk/clerk-react';
import { useApi } from '../../context/ApiContext';
import { useQueries } from '@tanstack/react-query';
import { formatRuntime } from '../../utils/timeFormat';
import { LatestSection } from '../../components/LatestSection';
import { triggerVibration } from '../../utils/haptics';

export const ProfileView = () => {
    const { user, isLoaded } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const api = useApi();


    const results = useQueries({
        queries: [
            {
                queryKey: ['userStats'],
                queryFn: () => api.user.getStats(),
            },
            {
                queryKey: ['latestMedias', 'movie'],
                queryFn: () => api.user.getLatestMedias('movie'),
            },
            {
                queryKey: ['latestMedias', 'tv'],
                queryFn: () => api.user.getLatestMedias('tv'),
            },
        ],
    });

    const [statsQuery, latestMoviesQuery, latestTvQuery] = results;
    const stats = statsQuery.data;
    const isStatsLoading = statsQuery.isLoading;

    const latestMovies = latestMoviesQuery.data;
    const latestTv = latestTvQuery.data;


    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">
                Chargement du profil...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">
                Utilisateur non trouvé.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            <div className="max-w-md mx-auto">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Mon Profil</h1>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 flex flex-row items-center gap-4 mb-6 shadow-lg">
                    {/* Avatar Cliquable avec Badge (Parfait pour Mobile et PC) */}
                    <button
                        onClick={() => openUserProfile()}
                        className="relative w-16 h-16 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all active:scale-95 flex-shrink-0"
                        title="Modifier mon profil"
                    >
                        {/* L'image de profil */}
                        <img
                            src={user.imageUrl}
                            alt="Avatar"
                            className="w-full h-full rounded-full border-4 border-zinc-800 object-cover"
                        />

                        {/* Le petit badge "Crayon" permanent en bas à droite */}
                        <div className="absolute bottom-0 right-0 bg-zinc-800 text-zinc-300 p-1 rounded-full border-2 border-zinc-950 shadow-sm hover:bg-purple-500 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </div>
                    </button>

                    {/* Conteneur des infos texte */}
                    <div className="flex flex-col flex-1">
                        <h2 className="text-lg font-bold text-zinc-100 leading-tight">
                            {user.fullName || 'Utilisateur'}
                        </h2>
                        <p className="text-zinc-400 text-xs mt-0.5">
                            {user.primaryEmailAddress?.emailAddress}
                        </p>
                        <div className="mt-2 self-start bg-zinc-800/50 text-zinc-300 text-[9px] px-2.5 py-0.5 rounded-full border border-zinc-700/50 uppercase tracking-widest font-semibold">
                            Membre
                        </div>
                    </div>
                </div>

                {/* Section Statistiques */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1 flex justify-between items-center">
                        <span>Mon Activité</span>
                        {isStatsLoading && <span className="text-[10px] text-purple-500 animate-pulse">Calcul...</span>}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        {/* CARTE FILMS */}
                        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-2xl mb-2">🎬</span>
                            <span className="text-2xl font-black text-zinc-100">
                                {stats?.movies.total_watched ?? '--'}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Films vus</span>

                            {/* Le Temps Passé */}
                            <div className="mt-3 pt-3 border-t border-zinc-800/50 w-full text-center">
                                <span className="text-xs font-bold text-purple-500">
                                    {stats ? formatRuntime(stats.movies.total_runtime_minutes) : '--'}
                                </span>
                                <p className="text-[9px] text-zinc-600 uppercase mt-0.5">Temps de visionnage</p>
                            </div>
                        </div>

                        {/* CARTE SÉRIES */}
                        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-2xl mb-2">📺</span>
                            <span className="text-2xl font-black text-zinc-100">
                                {stats?.tv.total_episodes_watched ?? '--'}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Épisodes vus</span>

                            {/* Le Temps Passé */}
                            <div className="mt-3 pt-3 border-t border-zinc-800/50 w-full text-center">
                                <span className="text-xs font-bold text-purple-500">
                                    {stats ? formatRuntime(stats.tv.total_runtime_minutes) : '--'}
                                </span>
                                <p className="text-[9px] text-zinc-600 uppercase mt-0.5">Temps de visionnage</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="my-10">
                    <LatestSection
                        title="Derniers films vus"
                        data={latestMovies}
                        isLoading={latestMoviesQuery.isLoading}
                        viewAllLink="/watched/movies"
                    />

                    <LatestSection
                        title="Dernières séries vues"
                        data={latestTv}
                        isLoading={latestTvQuery.isLoading}
                        viewAllLink="/watched/tv"
                    />
                </div>

                {/* Bouton Déconnexion (Largeur contenue sur PC) */}
                <button
                    onClick={() => {
                        triggerVibration([30, 100, 30]);
                        signOut();
                    }}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Se déconnecter
                </button>

            </div>
        </div >
    );
};