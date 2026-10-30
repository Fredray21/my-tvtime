import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useQueries } from '@tanstack/react-query';
import { Clapperboard, Clock, Heart, Layers, Settings, Sparkles, Tv } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { formatRuntime } from '../../utils/timeFormat';
import { LatestSection } from '../../components/LatestSection';
import { triggerVibration } from '../../utils/haptics';

export const ProfileView = () => {
    const { user, isLoaded } = useUser();
    const api = useApi();

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

    // Films et séries séparés : le nombre vu et le temps passé de chaque côté
    const statTiles = [
        { label: 'Films vus', icon: Clapperboard, count: stats?.movies.total_watched, minutes: stats?.movies.total_runtime_minutes },
        { label: 'Épisodes vus', icon: Tv, count: stats?.tv.total_episodes_watched, minutes: stats?.tv.total_runtime_minutes },
    ];

    // Une section n'apparaît que si elle a du contenu (ou pendant le chargement)
    const hasFavorites = favMoviesQuery.isLoading || favTvQuery.isLoading || !!favMoviesQuery.data?.length || !!favTvQuery.data?.length;
    const hasHistory = latestMoviesQuery.isLoading || latestTvQuery.isLoading || !!latestMoviesQuery.data?.results?.length || !!latestTvQuery.data?.results?.length;

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            <div className="max-w-md mx-auto">

                {/* EN-TÊTE COMPACT */}
                <div className="flex items-center gap-3 mb-6">
                    <img
                        src={user.imageUrl}
                        alt="Avatar"
                        className="w-12 h-12 rounded-full border-2 border-zinc-800 object-cover flex-shrink-0"
                    />
                    <div className="flex-grow min-w-0">
                        <h1 className="text-lg font-bold text-zinc-100 leading-tight line-clamp-1">{user.fullName || 'Utilisateur'}</h1>
                        <p className="text-zinc-500 text-xs line-clamp-1">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <Link
                        to="/settings"
                        onClick={() => triggerVibration([15])}
                        aria-label="Réglages"
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <Settings size={20} />
                    </Link>
                </div>

                {/* STATS : films et séries côte à côte, chacun avec son temps de visionnage */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    {statTiles.map(tile => (
                        <div key={tile.label} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                            <tile.icon size={20} className="text-zinc-500 flex-shrink-0" />
                            <div className="min-w-0">
                                {tile.count === undefined ? (
                                    <div className="h-6 w-12 bg-zinc-800 rounded animate-pulse" />
                                ) : (
                                    <p className="text-xl font-black text-zinc-100 leading-tight">{tile.count}</p>
                                )}
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{tile.label}</p>
                                {tile.minutes !== undefined && (
                                    <p className="text-[11px] font-bold text-purple-400 mt-1 leading-tight">{formatRuntime(tile.minutes)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* RACCOURCIS */}
                <div className="grid grid-cols-2 gap-2 mb-8">
                    <Link
                        to="/wrapped"
                        onClick={() => triggerVibration([15, 30])}
                        className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-600/30 to-zinc-900 hover:border-purple-400/50 transition-all active:scale-[0.98]"
                    >
                        <Sparkles size={20} className="text-purple-300 mb-2" />
                        <p className="text-sm font-bold text-white">Mon année</p>
                        <p className="text-[11px] text-zinc-400">Récap et partage</p>
                    </Link>
                    <Link
                        to="/sagas"
                        onClick={() => triggerVibration([15, 30])}
                        className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all active:scale-[0.98]"
                    >
                        <Layers size={20} className="text-zinc-300 mb-2" />
                        <p className="text-sm font-bold text-white">Mes sagas</p>
                        <p className="text-[11px] text-zinc-400">Ta progression</p>
                    </Link>
                </div>

                {/* FAVORIS */}
                {hasFavorites && (
                    <div className="mb-8">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center gap-2">
                            <Heart size={14} className="text-red-500" fill="currentColor" /> Coups de cœur
                        </h2>
                        <LatestSection
                            title="Films"
                            data={favMoviesQuery.data}
                            isLoading={favMoviesQuery.isLoading}
                            viewAllLink="/favorites/movies"
                            hideWhenEmpty
                        />
                        <LatestSection
                            title="Séries"
                            data={favTvQuery.data}
                            isLoading={favTvQuery.isLoading}
                            viewAllLink="/favorites/tv"
                            hideWhenEmpty
                        />
                    </div>
                )}

                {/* HISTORIQUE RÉCENT */}
                {hasHistory && (
                    <div className="mb-8">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center gap-2">
                            <Clock size={14} className="text-purple-500" /> Historique
                        </h2>
                        <LatestSection
                            title="Derniers films vus"
                            data={latestMoviesQuery.data?.results}
                            isLoading={latestMoviesQuery.isLoading}
                            viewAllLink="/watched/movies"
                            hideWhenEmpty
                        />
                        <LatestSection
                            title="Dernières séries vues"
                            data={latestTvQuery.data?.results}
                            isLoading={latestTvQuery.isLoading}
                            viewAllLink="/watched/tv"
                            hideWhenEmpty
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
