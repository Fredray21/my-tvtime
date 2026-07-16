import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { triggerVibration } from '../../utils/haptics';
import { CheckCircle } from 'lucide-react';
import { SeasonAccordion } from '../../components/SeasonAccordion';
import type { UpdateStatusDTO } from '../../api/mediaApi';

export const TVDetailsView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const api = useApi();
    const queryClient = useQueryClient();

    const seriesId = Number(id);
    const mediaType = 'tv';

    const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(false);

    // Récupération des données
    const { data: series, isLoading, isError } = useQuery({
        queryKey: ['tv', seriesId],
        queryFn: () => api.media.getMediaDetails(seriesId, mediaType),
        enabled: !isNaN(seriesId),
    });

    const { data: similarSeries, isLoading: isSimilarLoading } = useQuery({
        queryKey: ['tv', 'similar', seriesId],
        queryFn: () => api.media.getSimilarSeries(seriesId),
        enabled: !isNaN(seriesId) && !!series,
    });

    // Mutation globale
    const globalMutation = useMutation({
        mutationFn: async (variables: { newStatus: UpdateStatusDTO['status_local']; isFavorite: boolean }) => {
            if (variables.newStatus === 'not_tracked') {
                return api.media.removeMedia(seriesId, mediaType);
            }
            return api.media.updateStatus({
                tmdb_id: seriesId,
                media_type: mediaType,
                status_local: variables.newStatus,
                is_favorite: variables.isFavorite,
                rewatch_count: 0
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
            queryClient.invalidateQueries({ queryKey: ['watchlist'] });
        }
    });

    if (isLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">Chargement de la série...</div>;
    if (isError || !series) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    const backdropUrl = series.backdrop_path ? `https://image.tmdb.org/t/p/original${series.backdrop_path}` : '';
    const year = series.first_air_date ? new Date(series.first_air_date).getFullYear() : 'N/A';
    const safeRuntime = series.episode_run_time && series.episode_run_time.length > 0 ? series.episode_run_time[0] : 0;
    const formattedRuntime = safeRuntime > 0 ? `${safeRuntime}m` : '';

    // --- ALGORITHME DE SAISON PAR DÉFAUT ---
    const sortedSeasons = series.seasons ? [...series.seasons].sort((a, b) => {
        if (a.season_number === 0) return 1;
        if (b.season_number === 0) return -1;
        return a.season_number - b.season_number;
    }) : [];

    let defaultSeasonId = sortedSeasons[0]?.id;
    let minTier = Infinity;

    for (const season of sortedSeasons) {
        if (season.season_number === 0 || season.episode_count === 0) continue; // On ignore les "Spéciaux" pour le focus par défaut
        
        // Le "Tier" indique combien de fois la saison a été ENTIÈREMENT vue (0 = pas finie, 1 = vue 1 fois, etc.)
        const tier = Math.floor((season.watched_count || 0) / season.episode_count);
        
        // On trouve la première saison avec le Tier le plus bas
        if (tier < minTier) {
            minTier = tier;
            defaultSeasonId = season.id;
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* HEADER BACKGROUND IMAGE */}
            <div className="relative w-full aspect-video sm:aspect-[21/9] bg-zinc-900">
                {backdropUrl && <img src={backdropUrl} alt={series.name} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>

                <button onClick={() => { triggerVibration(); navigate(-1); }} className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition aspect-square">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>

                {series.status_local && series.status_local !== 'not_tracked' && (
                    <button
                        onClick={() => { triggerVibration([30, 100, 30]); globalMutation.mutate({ newStatus: series.status_local, isFavorite: !series.is_favorite }); }}
                        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full text-white transition bg-black/40 hover:bg-black/60 aspect-square"
                    >
                        {series.is_favorite ? '❤️' : '🤍'}
                    </button>
                )}
            </div>

            {/* CONTENU DE LA FICHE */}
            <div className="px-4 -mt-10 sm:-mt-16 relative z-10 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 leading-tight">{series.name}</h1>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-400 mb-6">
                    <span className="bg-zinc-800/80 px-2 py-1 rounded-md text-zinc-200">{year}</span>
                    {formattedRuntime && <span>⏱ ~{formattedRuntime}/ép.</span>}
                    <span>Saisons : {series.number_of_seasons}</span>
                    {series.vote_average !== undefined && series.vote_average > 0 && <span className="text-amber-400">⭐️ {series.vote_average.toFixed(1)}/10</span>}
                </div>

                <div className="mb-8">
                    <button
                        onClick={() => {
                            const isTracked = series.status_local && series.status_local !== 'not_tracked';
                            triggerVibration(isTracked ? [50, 80, 20] : [20, 80, 50]);
                            globalMutation.mutate({ newStatus: isTracked ? 'not_tracked' : 'watching', isFavorite: series.is_favorite });
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${series.status_local && series.status_local !== 'not_tracked' ? 'bg-purple-500 text-black hover:bg-purple-400' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
                    >
                        {series.status_local && series.status_local !== 'not_tracked' ? `➖ Ne plus suivre` : '➕ Suivre la série'}
                    </button>
                </div>

                {/* Synopsis */}
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-2">Synopsis</h2>
                    <p className={`text-zinc-300 text-sm leading-relaxed opacity-90 transition-all ${isOverviewExpanded ? '' : 'line-clamp-3'}`}>
                        {series.overview || "Aucun synopsis disponible."}
                    </p>
                    {series.overview && series.overview.length > 150 && (
                        <button onClick={() => setIsOverviewExpanded(!isOverviewExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 font-bold mt-1.5 uppercase tracking-wider">
                            {isOverviewExpanded ? 'Réduire' : 'Lire la suite...'}
                        </button>
                    )}
                </div>

                {/* --- NAVIGATION DES SAISONS --- */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Tous les épisodes</h2>
                        <div className="p-1.5 rounded-full border border-zinc-700 text-zinc-500">
                            <CheckCircle size={18} />
                        </div>
                    </div>
                    
                    {sortedSeasons.map((season) => (
                        <SeasonAccordion 
                            key={season.id} 
                            seriesId={seriesId} 
                            season={season} 
                            defaultOpen={season.id === defaultSeasonId} // 🟢 Ouvre intelligemment la bonne saison
                        />
                    ))}
                </div>

                {/* --- RECOMMANDATIONS --- */}
                <div className="mb-12 border-t border-zinc-800/50 pt-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">Séries similaires</h2>
                    {isSimilarLoading ? (
                        <div className="flex gap-3 overflow-x-hidden">
                            {[1, 2, 3].map((i) => <div key={i} className="w-28 h-40 bg-zinc-900 rounded-xl animate-pulse flex-shrink-0" />)}
                        </div>
                    ) : similarSeries && similarSeries.length > 0 ? (
                        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-none snap-x">
                            {similarSeries.map((similar) => (
                                <div key={similar.id} className="w-28 flex-shrink-0 snap-start">
                                    <MediaCard item={similar} layout="card" fallbackMediaType={mediaType} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-4 rounded-xl text-center border border-dashed border-zinc-800">
                            Aucune recommandation disponible.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};