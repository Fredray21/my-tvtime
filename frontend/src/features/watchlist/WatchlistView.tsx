import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { useState } from 'react';
import { MediaCard } from '../../components/MediaCard';

interface WatchlistViewProps {
    mediaType: 'movie' | 'tv';
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ mediaType }) => {
    const api = useApi();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'to_watch' | 'upcoming'>('to_watch')
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['watchlist', mediaType],
        queryFn: ({ pageParam = 1 }) => api.media.getWatchlist(pageParam, mediaType),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_next_page ? lastPage.page + 1 : undefined,
    });

    // La mutation reste exactement la même !
    const mutation = useMutation({
        mutationFn: async (variables: { movieId: number; newStatus: 'watchlist' | 'watched' | 'not_tracked' }) => {
            if (variables.newStatus === 'not_tracked') {
                return api.media.removeMedia(variables.movieId, mediaType);
            }
            return api.media.updateStatus({
                tmdb_id: variables.movieId,
                media_type: mediaType,
                status_local: variables.newStatus,
                is_favorite: false,
                rewatch_count: 0,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['watchlist', mediaType] });
        },
    });

    // 2. On "aplatit" toutes les pages en un seul tableau de films
    const allMovies = data?.pages.flatMap((page) => page.results) || [];

    const today = new Date().toISOString().split('T')[0]; // Format "YYYY-MM-DD"

    const filteredMovies = allMovies.filter((item) => {
        // Si TMDB n'a pas de date, on considère que c'est dispo par défaut
        const releaseDate = item.release_date || "1900-01-01";

        if (activeTab === 'upcoming') {
            return releaseDate > today;
        } else {
            return releaseDate <= today;
        }
    });

    if (isLoading) return <div className="text-white text-center pt-10">Chargement de ta liste...</div>;
    if (isError) return <div className="text-red-500 text-center pt-10">Erreur lors du chargement.</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            {/* Header dynamique avec Boutons de Vue */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    {mediaType === 'movie' ? 'Mes Films à voir' : 'Mes Séries à voir'}
                </h1>

                {/* Le Toggle Card / List */}
                <div className="flex align-items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button
                        onClick={() => setViewMode('card')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-zinc-800 text-purple-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-purple-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
                <button
                    onClick={() => setActiveTab('to_watch')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'to_watch' ? 'bg-purple-500 text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    À voir
                </button>
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-purple-500 text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                >
                    À venir
                </button>
            </div>



            {(!filteredMovies || filteredMovies.length === 0) ? (
                <div className="flex flex-col items-center justify-center mt-20 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto">
                    <div className="text-4xl mb-4">🍿</div>
                    <h2 className="text-lg font-bold mb-2">Ta liste est vide</h2>
                    <p className="text-sm text-zinc-400 text-center">Cherche un film et ajoute-le à ta watchlist pour le retrouver ici.</p>
                </div>
            ) : (
                <div>
                    {/* Grille adaptative pour les cartes */}
                    <div className={viewMode === 'card'
                        ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
                        : "flex flex-col gap-3"
                    }>
                        {filteredMovies.map((movie) => (
                            <MediaCard
                                key={movie.id}
                                item={movie}
                                fallbackMediaType={mediaType}
                                layout={viewMode}
                                onStatusChange={(movieId, newStatus) => mutation.mutate({ movieId, newStatus })}
                            />
                        ))}
                    </div>

                    {/* 3. Bouton Charger Plus */}
                    {hasNextPage && (
                        <div className="mt-8 mb-4 flex justify-center">
                            <button
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold px-6 py-2.5 rounded-xl border border-zinc-800 shadow-md transition-all disabled:opacity-50"
                            >
                                {isFetchingNextPage ? 'Chargement...' : 'Afficher plus de films'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};