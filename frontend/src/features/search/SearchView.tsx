import React, { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../context/ApiContext';
import { useDebounce } from '../../hooks/useDebounce';
import { MediaCard } from '../../components/MediaCard';
import { triggerVibration } from '../../utils/haptics';
import { useLocalStorage } from '../../utils/useLocalStorage';
import { Grid, List } from 'lucide-react';

type TabType = 'all' | 'movie' | 'tv' | 'person';

export const SearchView = () => {
    const api = useApi();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabType) || 'all';

    const [localQuery, setLocalQuery] = useState(searchParams.get('q') || '');
    const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('search_list_view_mode', 'card');

    const debouncedQuery = useDebounce(localQuery, 500);

    // 1. RECHERCHE TOUT (Multi-search sans pagination)
    const { data: multiData, isLoading: isMultiLoading } = useQuery({
        queryKey: ['search-multi', debouncedQuery],
        queryFn: () => api.search.searchMulti(debouncedQuery),
        enabled: debouncedQuery.length > 1 && activeTab === 'all',
    });

    // 2. RECHERCHE SPÉCIFIQUE (Paginée avec useInfiniteQuery)
    const {
        data: pagedData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isPagedLoading,
    } = useInfiniteQuery({
        queryKey: ['search-paged', activeTab, debouncedQuery],
        queryFn: ({ pageParam = 1 }) => api.search.searchPaged(activeTab as any, debouncedQuery, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
        enabled: debouncedQuery.length > 1 && activeTab !== 'all',
    });

    React.useEffect(() => {
        setSearchParams((prev) => {
            if (debouncedQuery) {
                prev.set('q', debouncedQuery);
            } else {
                prev.delete('q');
            }
            return prev;
        }, { replace: true });
    }, [debouncedQuery, setSearchParams]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalQuery(e.target.value);
    };

    const handleTabChange = (tab: TabType) => {
        setSearchParams((prev) => {
            prev.set('tab', tab);
            return prev;
        }, { replace: true });
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* ZONE COLLANTE (SEARCH BAR + TABS) */}
            <div className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md pt-6 px-4 border-b border-zinc-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Films, séries, acteurs..."
                            value={localQuery}
                            onChange={handleSearchChange}
                            className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-sm rounded-xl px-4 py-3 border border-zinc-800 focus:outline-none focus:border-zinc-700 font-medium transition-all"
                        />
                        {/* BOUTON CLEAN */}
                        {localQuery && (
                            <button
                                onClick={() => { setLocalQuery(''); triggerVibration([10]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>

                    <div className="flex justify-between items-end gap-4 h-12">
                        <div className="flex text-sm font-semibold overflow-x-auto scrollbar-none gap-2 flex-grow">
                            {(['all', 'movie', 'tv', 'person'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => { triggerVibration(15); handleTabChange(tab) }}
                                    className={`pb-3 px-2 capitalize border-b-2 transition-all whitespace-nowrap ${activeTab === tab
                                        ? 'border-purple-500 text-purple-500'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {tab === 'all' ? 'Tout' : tab === 'movie' ? 'Films' : tab === 'tv' ? 'Séries' : 'Acteurs'}
                                </button>
                            ))}
                        </div>

                        {activeTab !== 'all' && (
                            <div className="flex items-center mb-3 flex-shrink-0">
                                <button
                                    onClick={() => { triggerVibration([10]); setViewMode(prev => prev === 'card' ? 'list' : 'card'); }}
                                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                                >
                                    {viewMode === 'card' ? <List size={20} /> : <Grid size={20} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-4 mt-6 max-w-7xl mx-auto">
                {debouncedQuery.length <= 1 ? (
                    <div className="text-center text-zinc-600 text-xs mt-20">Tape au moins 2 caractères pour lancer la recherche...</div>
                ) : activeTab === 'all' ? (
                    // RENDER DE L'ONGLET TOUT (SLIDERS)
                    isMultiLoading ? (
                        <p className="text-zinc-500 text-xs animate-pulse text-center mt-10">Recherche globale...</p>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* Section Films */}
                            {multiData?.movies && multiData.movies.length > 0 && (
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-400 mb-3 px-1 tracking-wider uppercase text-[11px]">Films</h2>
                                    <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none snap-x">
                                        {multiData.movies.map((item) => (
                                            <div key={item.id} className="w-28 flex-shrink-0 snap-start">
                                                <MediaCard item={item} layout="card" fallbackMediaType='movie' />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section Séries */}
                            {multiData?.tvShows && multiData.tvShows.length > 0 && (
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-400 mb-3 px-1 tracking-wider uppercase text-[11px]">Séries</h2>
                                    <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none snap-x">
                                        {multiData.tvShows.map((item) => (
                                            <div key={item.id} className="w-28 flex-shrink-0 snap-start">
                                                <MediaCard item={item} layout="card" fallbackMediaType='tv' />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section Acteurs */}
                            {multiData?.actors && multiData.actors.length > 0 && (
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-400 mb-3 px-1 tracking-wider uppercase text-[11px]">Acteurs</h2>
                                    <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none snap-x">
                                        {multiData.actors.map((item) => (
                                            <div key={item.id} className="w-28 flex-shrink-0 snap-start">
                                                <MediaCard item={item} layout='card' fallbackMediaType='person' />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    // RENDER DES ONGLETS SPÉCIFIQUES (GRILLE + PAGINATION)
                    isPagedLoading ? (
                        <p className="text-zinc-500 text-xs animate-pulse text-center mt-10">Chargement des résultats...</p>
                    ) : (
                        <div>
                            <div className={
                                viewMode === 'card'
                                    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 lg:gap-4"
                                    : "flex flex-col gap-3 w-full max-w-3xl mx-auto" // mx-auto centre la liste sur grand écran pour éviter qu'elle fasse 3 mètres de long
                            }>
                                {pagedData?.pages.flatMap((page) => page.results).map((item) => (
                                    <MediaCard
                                        key={item.id}
                                        item={item}
                                        layout={viewMode}
                                        fallbackMediaType={activeTab as 'movie' | 'tv' | 'person'}
                                    />
                                ))}
                            </div>

                            {/* Bouton Load More */}
                            {hasNextPage && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => fetchNextPage()}
                                        disabled={isFetchingNextPage}
                                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold px-6 py-2.5 rounded-xl border border-zinc-800 shadow-md transition-all disabled:opacity-50"
                                    >
                                        {isFetchingNextPage ? 'Chargement...' : 'Afficher plus de résultats'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

        </div>
    );
};