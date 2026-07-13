import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { useLocalStorage } from '../../utils/useLocalStorage';

interface WatchedViewProps {
    mediaType: 'movie' | 'tv';
}

export const WatchedView: React.FC<WatchedViewProps> = ({ mediaType }) => {
    const api = useApi();
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('watched_view_mode','card');


    // On récupère toute la liste (backend avec limit=0)
    const { data: movies, isLoading, isError } = useQuery({
        queryKey: ['watched', mediaType],
        queryFn: () => api.user.getLatestMedias(mediaType), // Ton endpoint qui renvoie tout
    });

    if (isLoading) return <div className="text-zinc-500 text-center pt-10">Chargement...</div>;
    if (isError) return <div className="text-red-500 text-center pt-10">Erreur lors du chargement.</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            {/* Header avec Toggle ViewMode */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    {mediaType === 'movie' ? 'Films vus' : 'Séries vues'}
                </h1>

                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button
                        onClick={() => setViewMode('card')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            {/* Liste ou Grille */}
            {(!movies || movies.length === 0) ? (
                <div className="flex flex-col items-center justify-center mt-20 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto">
                    <div className="text-4xl mb-4">🎬</div>
                    <h2 className="text-lg font-bold mb-2">Aucun historique</h2>
                    <p className="text-sm text-zinc-400 text-center">Marque tes contenus comme vus pour les retrouver ici.</p>
                </div>
            ) : (
                <div className={viewMode === 'card'
                    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
                    : "flex flex-col gap-3"
                }>
                    {movies.map((item) => (
                        <MediaCard
                            key={item.id}
                            item={item}
                            fallbackMediaType={mediaType}
                            layout={viewMode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};