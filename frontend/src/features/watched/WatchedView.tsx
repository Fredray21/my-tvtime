import React, { useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { useLocalStorage } from '../../utils/useLocalStorage';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { triggerVibration } from '../../utils/haptics';

interface WatchedViewProps {
    mediaType: 'movie' | 'tv';
}

export const WatchedView: React.FC<WatchedViewProps> = ({ mediaType }) => {
    const api = useApi();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('watched_view_mode', 'card');

    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['watched', mediaType],
        queryFn: ({ pageParam = 1 }) => api.user.getLatestMedias(mediaType, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_next_page ? lastPage.page + 1 : undefined,
    });

    const observer = useRef<IntersectionObserver | null>(null);
    const bottomBoundaryRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return; // Ne rien faire si ça charge déjà

            // On déconnecte l'ancien observateur s'il y en avait un
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                // Si l'élément est visible à l'écran et qu'il y a une page suivante
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            if (node) observer.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage]
    );
    const movies = data?.pages.flatMap((page) => page.results) || [];

    if (isLoading) return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">
            <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Chargement des données...
            </div>
        </div>
    )
    if (isError) return <div className="text-red-500 text-center pt-10">Erreur lors du chargement.</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white pt-6 pb-24">
            <div className="max-w-7xl mx-auto px-4 w-full">
                {/* Bouton Back + Titre */}
                <div className="flex items-center mb-6 gap-4">
                    <button
                        onClick={() => navigate('/profile')}
                        className="p-2 hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mediaType === 'movie' ? 'Derniers films vus' : 'Dernières séries vues'}
                    </h1>
                </div>

                {/* Header avec Toggle ViewMode */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mediaType === 'movie' ? 'Films vus' : 'Séries vues'}
                    </h1>

                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                        <button
                            onClick={() => {
                                triggerVibration(15);
                                setViewMode('card');
                            }}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button
                            onClick={() => {
                                triggerVibration(15);
                                setViewMode('list');
                            }}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                </div>

                {/* Liste ou Grille */}
                {movies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto">
                        <div className="text-4xl mb-4">🎬</div>
                        <h2 className="text-lg font-bold mb-2">Aucun historique</h2>
                        <p className="text-sm text-zinc-400 text-center">Marque tes contenus comme vus pour les retrouver ici.</p>
                    </div>
                ) : (
                    <div className={viewMode === 'card'
                        ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3" //Ajout du responsive PC
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

                {/*Bouton Charger Plus sécurisé */}
                {hasNextPage && (
                    <div
                        ref={bottomBoundaryRef}
                        className="w-full mt-8 py-6 flex justify-center text-zinc-500 font-semibold"
                    >
                        {isFetchingNextPage ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Chargement de la suite...
                            </div>
                        ) : (
                            "Défilement..."
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};