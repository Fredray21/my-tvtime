import { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useApi } from '../../context/ApiContext';
import { useQueries } from '@tanstack/react-query';
import { formatRuntime } from '../../utils/timeFormat';
import { LatestSection } from '../../components/LatestSection';
import { triggerVibration } from '../../utils/haptics';
import { TVTimeImport } from '../../components/TVTimeImport';
import { Clapperboard, FileUp, Tv, Heart, Clock } from 'lucide-react';

export const ProfileView = () => {
    const { user, isLoaded } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const api = useApi();
    const [isImportOpen, setIsImportOpen] = useState(false);

    // On charge toutes les données en parallèle (Stats, Historique et Favoris)
    const results = useQueries({
        queries: [
            {
                queryKey: ['userStats'],
                queryFn: () => api.user.getStats(),
            },
            {
                queryKey: ['latestMedias', 'movie'],
                queryFn: () => api.user.getLatestMedias('movie', 1),
            },
            {
                queryKey: ['latestMedias', 'tv'],
                queryFn: () => api.user.getLatestMedias('tv', 1),
            },
            {
                queryKey: ['favorites', 'movie'],
                // Assure-toi que c'est bien api.media (ou le nom exact de ton sous-objet api)
                queryFn: () => api.media.getFavorites('movie'),
            },
            {
                queryKey: ['favorites', 'tv'],
                queryFn: () => api.media.getFavorites('tv'),
            },
        ],
    });

    const [
        statsQuery,
        latestMoviesQuery,
        latestTvQuery,
        favMoviesQuery,
        favTvQuery
    ] = results;

    const stats = statsQuery.data;
    const isStatsLoading = statsQuery.isLoading;

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

                {/* HEADER */}
                <div className="mb-6 flex justify-between items-center">
                    <h1 className="text-2xl font-bold tracking-tight">Mon Profil</h1>

                    <button
                        onClick={() => {
                            triggerVibration([15, 30]);
                            setIsImportOpen(true);
                        }}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <FileUp size={16} /> Import TV Time
                        </span>
                    </button>
                </div>

                {/* PROFIL CARD */}
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 flex flex-row items-center gap-4 mb-6 shadow-lg">
                    <button
                        onClick={() => openUserProfile()}
                        className="relative w-16 h-16 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all active:scale-95 flex-shrink-0"
                        title="Modifier mon profil"
                    >
                        <img
                            src={user.imageUrl}
                            alt="Avatar"
                            className="w-full h-full rounded-full border-4 border-zinc-800 object-cover"
                        />
                        <div className="absolute bottom-0 right-0 bg-zinc-800 text-zinc-300 p-1 rounded-full border-2 border-zinc-950 shadow-sm hover:bg-purple-500 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </div>
                    </button>

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

                        <button
                            onClick={() => {
                                triggerVibration([30, 100, 30]);
                                signOut();
                            }}
                            className="mt-4 w-full py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Se déconnecter
                        </button>
                    </div>
                </div>

                {/* STATISTIQUES */}
                <div className="mb-10">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1 flex justify-between items-center">
                        <span>Mon Activité</span>
                        {isStatsLoading && <span className="text-[10px] text-purple-500 animate-pulse">Calcul...</span>}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-2xl mb-2"><Clapperboard /></span>
                            <span className="text-2xl font-black text-zinc-100">
                                {stats?.movies.total_watched ?? '--'}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Films vus</span>

                            <div className="mt-3 pt-3 border-t border-zinc-800/50 w-full text-center">
                                <span className="text-xs font-bold text-purple-500">
                                    {stats ? formatRuntime(stats.movies.total_runtime_minutes) : '--'}
                                </span>
                                <p className="text-[9px] text-zinc-600 uppercase mt-0.5">Temps de visionnage</p>
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-2xl mb-2"><Tv /></span>
                            <span className="text-2xl font-black text-zinc-100">
                                {stats?.tv.total_episodes_watched ?? '--'}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Épisodes vus</span>

                            <div className="mt-3 pt-3 border-t border-zinc-800/50 w-full text-center">
                                <span className="text-xs font-bold text-purple-500">
                                    {stats ? formatRuntime(stats.tv.total_runtime_minutes) : '--'}
                                </span>
                                <p className="text-[9px] text-zinc-600 uppercase mt-0.5">Temps de visionnage</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FAVORIS */}
                <div className="mb-10">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
                        <Heart size={14} className="text-red-500" fill="currentColor" /> Mes Favoris
                    </h3>

                    <div className="space-y-6">
                        <LatestSection
                            title="Films Coups de cœur"
                            data={favMoviesQuery.data} // Le retour est directement le tableau
                            isLoading={favMoviesQuery.isLoading}
                            viewAllLink="/favorites/movies"
                        />

                        <LatestSection
                            title="Séries Coups de cœur"
                            data={favTvQuery.data} // Le retour est directement le tableau
                            isLoading={favTvQuery.isLoading}
                            viewAllLink="/favorites/tv"
                        />
                    </div>
                </div>

                {/* HISTORIQUE RÉCENT */}
                <div className="mb-10">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
                        <Clock size={14} className="text-purple-500" /> Historique
                    </h3>

                    <div className="space-y-6">
                        <LatestSection
                            title="Derniers films vus"
                            data={latestMoviesQuery.data?.results}
                            isLoading={latestMoviesQuery.isLoading}
                            viewAllLink="/watched/movies"
                        />

                        <LatestSection
                            title="Dernières séries vues"
                            data={latestTvQuery.data?.results}
                            isLoading={latestTvQuery.isLoading}
                            viewAllLink="/watched/tv"
                        />
                    </div>
                </div>

                {/* MODALE D'IMPORT */}
                {isImportOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl w-full max-w-2xl relative shadow-2xl animate-fade-in">
                            <button
                                onClick={() => {
                                    triggerVibration([15]);
                                    setIsImportOpen(false);
                                }}
                                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors z-10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>

                            <TVTimeImport />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};