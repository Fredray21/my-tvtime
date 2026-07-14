import React, { useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Grid } from 'lucide-react';
import { useLocalStorage } from '../utils/useLocalStorage';
import { triggerVibration } from '../utils/haptics';
import { MediaCard } from './MediaCard';

interface MediaGridPageProps {
    title: string;
    icon: React.ElementType;
    mediaType: 'movie' | 'tv';
    queryKey: any[];
    // Le queryFn doit accepter pageParam pour l'infinite scroll
    queryFn: ({ pageParam }: { pageParam: number }) => Promise<any>;
    emptyTitle: string;
    emptyDescription: string;
}

export const MediaGridPage: React.FC<MediaGridPageProps> = ({ 
    title, 
    icon: Icon, 
    mediaType, 
    queryKey, 
    queryFn,
    emptyTitle,
    emptyDescription
}) => {
    const navigate = useNavigate();
    // Reprise exacte de ton système de vue (card/list)
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('media_grid_view_mode', 'card');

    // Utilisation de useInfiniteQuery comme dans WatchedView
    const { 
        data, 
        isLoading, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage 
    } = useInfiniteQuery({
        queryKey,
        queryFn,
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            // Sécurité : si l'API renvoie un simple tableau (ex: Favoris), il n'y a pas de page suivante.
            if (Array.isArray(lastPage)) return undefined; 
            // Sinon, c'est paginé (ex: Latest TV/Movies)
            return lastPage.has_next_page ? lastPage.page + 1 : undefined;
        },
    });

    // Reprise exacte de ton IntersectionObserver pour le chargement infini
    const observer = useRef<IntersectionObserver | null>(null);
    const bottomBoundaryRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return;
            if (observer.current) observer.current.disconnect();
            
            observer.current = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });
            
            if (node) observer.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage]
    );

    // Extraction des items : gère les API paginées ({results: []}) ET les API brutes ([...])
    const items = data?.pages.flatMap(page => Array.isArray(page) ? page : (page.results || [])) || [];

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            <div className="max-w-4xl mx-auto">
                
                {/* HEADER */}
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-zinc-950/90 backdrop-blur-md py-4 z-10 border-b border-zinc-900/50">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <Icon size={20} className={title.includes('cœur') ? 'text-red-500' : 'text-purple-500'} />
                            {title}
                        </h1>
                    </div>

                    {/* BOUTON TOGGLE VUE (Grid / List) */}
                    <button
                        onClick={() => {
                            triggerVibration([10]);
                            setViewMode(prev => prev === 'card' ? 'list' : 'card');
                        }}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        aria-label="Changer la vue"
                    >
                        {viewMode === 'card' ? <List size={20} /> : <Grid size={20} />}
                    </button>
                </div>

                {/* ÉTAT DE CHARGEMENT INITIAL */}
                {isLoading && (
                    <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 animate-pulse" : "flex flex-col gap-3 animate-pulse"}>
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className={viewMode === 'card' ? "aspect-[2/3] bg-zinc-900 rounded-xl" : "h-24 bg-zinc-900 rounded-xl"}></div>
                        ))}
                    </div>
                )}

                {/* ÉTAT VIDE */}
                {!isLoading && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
                        <div className="bg-zinc-900 p-4 rounded-full mb-4">
                            <Icon size={32} className="text-zinc-600" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-300 mb-1">{emptyTitle}</h2>
                        <p className="text-sm">{emptyDescription}</p>
                    </div>
                )}

                {/* LISTE / GRILLE DES MÉDIAS */}
                {!isLoading && items.length > 0 && (
                    <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4" : "flex flex-col gap-3"}>
                        {items.map((item: any) => (
                            <MediaCard
                                key={item.id || item.tmdb_id || item.tmdb_series_id || item.tmdb_movie_id}
                                item={item}
                                fallbackMediaType={mediaType}
                                layout={viewMode}
                            />
                        ))}
                    </div>
                )}

                {/* LOADER INFINITE SCROLL */}
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
                            <span>Plus de résultats ↓</span>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};