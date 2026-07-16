import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { useCallback, useRef, useState } from 'react';
import { MediaCard } from '../../components/MediaCard';
import { useLocalStorage } from '../../utils/useLocalStorage';
import { triggerVibration } from '../../utils/haptics';
import { Grid, List, Tv, Hourglass, PlayCircle, CheckCircle, Popcorn } from 'lucide-react';

interface WatchlistViewProps {
    mediaType: 'movie' | 'tv';
}

interface SeriesItem {
    id: number;
    name: string;
    status_local: string;
    next_episode_to_air?: {
        air_date: string;
    };
    [key: string]: any;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ mediaType }) => {
    const api = useApi();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'to_watch' | 'upcoming'>('to_watch');
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>(`watchlist_view_mode_${mediaType}`, 'card');

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['watchlist', mediaType, activeTab],
        queryFn: ({ pageParam = 1 }) => {
            if (activeTab === 'upcoming') {
                return mediaType === 'movie'
                    ? api.media.getUpcomingMovies(pageParam)
                    : api.media.getUpcomingSeries(pageParam);
            }
            return api.media.getWatchlist(pageParam, mediaType);
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_next_page ? lastPage.page + 1 : undefined,
    });

    const observer = useRef<IntersectionObserver | null>(null);
    const bottomBoundaryRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (observer.current) observer.current.disconnect();

            if (node && hasNextPage) {
                observer.current = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting && !isFetchingNextPage) {
                        fetchNextPage();
                    }
                }, {
                    rootMargin: '400px'
                });

                observer.current.observe(node);
            }
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage]
    );

    const mutation = useMutation({
        mutationFn: async (variables: { movieId: number; newStatus: string }) => {
            if (variables.newStatus === 'not_tracked') {
                return api.media.removeMedia(variables.movieId, mediaType);
            }
            return api.media.updateStatus({
                tmdb_id: variables.movieId,
                media_type: mediaType,
                status_local: variables.newStatus as any,
                is_favorite: false,
                rewatch_count: 0,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['watchlist', mediaType] });
            queryClient.invalidateQueries({ queryKey: ['userStats'] });
            queryClient.invalidateQueries({ queryKey: ['latestMedias'] });
        },
    });

    const rawData = data?.pages.flatMap((page) => page.results || []) || [];
    const uniqueData = Array.from(new Map(rawData.map(item => [item.id, item])).values());

    let displayData = uniqueData;

    if (activeTab === 'to_watch' && mediaType === 'movie') {
        displayData = displayData.filter((item) => {
            if (!item.release_date) return true;
            return new Date(item.release_date).getTime() <= new Date().getTime();
        });
    }

    const groupedByDate = activeTab === 'upcoming'
        ? displayData.reduce((acc, item) => {
            const date = item.next_episode_to_air?.air_date || item.release_date || 'Inconnu';
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
        }, {} as Record<string, typeof displayData>)
        : {};

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    if (isLoading) return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">
            <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                Chargement...
            </div>
        </div>
    )
    if (isError) return <div className="text-red-500 text-center pt-10">Erreur lors du chargement.</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            <div className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md pt-6 px-4 border-b border-zinc-900/50">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {mediaType === 'movie' ? 'Mes Films' : 'Mes Séries'}
                        </h1>
                        <button
                            onClick={() => { triggerVibration([10]); setViewMode(prev => prev === 'card' ? 'list' : 'card'); }}
                            className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                        >
                            {viewMode === 'card' ? <List size={20} /> : <Grid size={20} />}
                        </button>
                    </div>

                    <div className="flex bg-zinc-900 rounded-xl p-1 mb-4">
                        <button onClick={() => { triggerVibration(10); setActiveTab('to_watch'); }} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'to_watch' ? 'bg-purple-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-300'}`}>À voir</button>
                        <button onClick={() => { triggerVibration(10); setActiveTab('upcoming'); }} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-purple-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-300'}`}>À venir</button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 w-full mt-6">
                {displayData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto">
                        <Popcorn className="w-12 h-12 text-zinc-700 mb-4" />
                        <h2 className="text-lg font-bold mb-2">Ta liste est vide</h2>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {activeTab === 'upcoming' ? (
                            sortedDates.map((date) => (
                                <div key={date}>
                                    <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase tracking-wider">
                                        {date === 'Inconnu' ? 'Date inconnue' : new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h3>
                                    <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3" : "flex flex-col gap-3"}>
                                        {groupedByDate[date].map((item: SeriesItem) => (
                                            <MediaCard
                                                key={item.id}
                                                item={item}
                                                layout={viewMode}
                                                fallbackMediaType={mediaType}
                                                onStatusChange={(id, status) => mutation.mutate({ movieId: id, newStatus: status })}
                                                onWatchEpisode={(id, season, episode) => {
                                                    api.media.watchEpisode(id, season, episode).then(() => {
                                                        queryClient.invalidateQueries({ queryKey: ['watchlist', mediaType] });
                                                    });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            mediaType === 'tv' ? (
                                [
                                    { id: 'watching', title: 'En cours', icon: <Tv size={18} /> },
                                    { id: 'pending', title: 'En attente', icon: <Hourglass size={18} /> },
                                    { id: 'watchlist', title: 'À commencer', icon: <PlayCircle size={18} /> },
                                    { id: 'finished', title: 'Terminées', icon: <CheckCircle size={18} className="fill-emerald-500 text-black" /> }
                                ].map((section) => {
                                    const sectionItems = displayData.filter(i => i.status_local === section.id);
                                    if (sectionItems.length === 0) return null;
                                    return (
                                        <div key={section.id}>
                                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">{section.icon} {section.title}</h2>
                                            <div className={viewMode === 'card' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3" : "flex flex-col gap-3"}>
                                                {sectionItems.map((item) => (
                                                    <MediaCard
                                                        key={item.id}
                                                        item={item}
                                                        layout={viewMode}
                                                        fallbackMediaType="tv"
                                                        onStatusChange={(id, status) => mutation.mutate({ movieId: id, newStatus: status })}
                                                        onWatchEpisode={(id, season, episode) => {
                                                            api.media.watchEpisode(id, season, episode).then(() => {
                                                                queryClient.invalidateQueries({ queryKey: ['watchlist', mediaType] });
                                                            });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
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
                            )
                        )}

                        {hasNextPage && (
                            <div ref={bottomBoundaryRef} className="w-full py-6 flex justify-center text-zinc-500 font-semibold">
                                {isFetchingNextPage ? "Chargement..." : "..."}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};