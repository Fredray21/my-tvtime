import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { useCallback, useRef, useState } from 'react';
import { MediaCard } from '../../components/MediaCard';
import { useLocalStorage } from '../../utils/useLocalStorage';

interface WatchlistViewProps {
    mediaType: 'movie' | 'tv';
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ mediaType }) => {
    const api = useApi();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'to_watch' | 'upcoming'>('to_watch');
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('watchlist_view_mode', 'card');

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

    const observer = useRef<IntersectionObserver | null>(null);
    const bottomBoundaryRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return; // Ne rien faire si ça charge déjà

            // On déconnecte l'ancien observateur s'il y en avait un
            if (observer.current) observer.current.disconnect();

            // On crée le nouvel observateur
            observer.current = new IntersectionObserver((entries) => {
                // Si l'élément est visible à l'écran et qu'il y a une page suivante
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            // On attache l'observateur à notre div invisible
            if (node) observer.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage]
    );

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

    const allItems = data?.pages.flatMap((page) => page.results || []) || [];
    const today = new Date().toISOString().split('T')[0];

    const getFilteredData = () => {
        if (mediaType === 'movie') {
            return allItems.filter((item) => {
                const releaseDate = item.release_date || "1900-01-01";
                return activeTab === 'upcoming' ? releaseDate > today : releaseDate <= today;
            });
        }
        return allItems;
    };

    const displayData = getFilteredData();

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
            {/*max-w-7xl mx-auto pour centrer et limiter la largeur sur PC */}
            <div className="max-w-7xl mx-auto px-4 w-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mediaType === 'movie' ? 'Mes Films' : 'Mes Séries'}
                    </h1>
                    <div className="flex align-items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                        <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md ${viewMode === 'card' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-zinc-800 text-purple-500' : 'text-zinc-500'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></button>
                    </div>
                </div>

                {/* Tabs Films vs Sections Séries */}
                {mediaType === 'movie' ? (
                    <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
                        <button onClick={() => setActiveTab('to_watch')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${activeTab === 'to_watch' ? 'bg-purple-500 text-black' : 'text-zinc-400'}`}>À voir</button>
                        <button onClick={() => setActiveTab('upcoming')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${activeTab === 'upcoming' ? 'bg-purple-500 text-black' : 'text-zinc-400'}`}>À venir</button>
                    </div>
                ) : null}

                {/* Vérification du contenu vide */}
                {displayData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto">
                        <div className="text-4xl mb-4">🍿</div>
                        <h2 className="text-lg font-bold mb-2">Ta liste est vide</h2>
                        <p className="text-sm text-zinc-400 text-center">
                            {activeTab === 'upcoming'
                                ? "Aucun film à venir dans ta liste."
                                : `Cherche un ${mediaType === 'movie' ? 'film' : 'série'} et ajoute-le.`}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {mediaType === 'tv' ? (
                            /* Sections Séries */
                            [
                                { id: 'watching', title: '📺 En cours' },
                                { id: 'pending', title: '⏳ En attente' },
                                { id: 'watchlist', title: '🆕 À commencer' },
                                { id: 'finished', title: '✅ Terminées' }
                            ].map((section) => {
                                const sectionItems = allItems.filter(i => i.status_local === section.id);
                                if (sectionItems.length === 0) return null;
                                return (
                                    <div key={section.id}>
                                        <h2 className="text-lg font-bold mb-4">{section.title}</h2>
                                        {/*Ajout du responsive PC (lg/xl grid cols) */}
                                        <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3" : "flex flex-col gap-3"}>
                                            {sectionItems.map((item) => (
                                                <MediaCard
                                                    key={item.id}
                                                    item={item}
                                                    layout={viewMode}
                                                    fallbackMediaType="tv"
                                                    onStatusChange={(id, status) => mutation.mutate({ movieId: id, newStatus: status })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            /* Grille Films */
                            /*Ajout du responsive PC (lg/xl grid cols) */
                            <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3" : "flex flex-col gap-3"}>
                                {displayData.map((item) => (
                                    <MediaCard
                                        key={item.id}
                                        item={item}
                                        layout={viewMode}
                                        fallbackMediaType="movie"
                                        onStatusChange={(id, status) => mutation.mutate({ movieId: id, newStatus: status })}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Bouton Charger Plus sécurisé (ne s'affiche que si on a des données et une page suivante) */}
                {hasNextPage && displayData.length > 0 && (
                    <div
                        ref={bottomBoundaryRef}
                        className="w-full mt-8 py-6 flex justify-center text-zinc-500 font-semibold"
                    >
                        {isFetchingNextPage ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
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