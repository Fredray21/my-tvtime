import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, onlineManager } from '@tanstack/react-query';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import { useConfirm } from '../hooks/useConfirm';
import type { EpisodeCustomResponse, MediaCustomResponse, SeasonCustomResponse, TMDBSeasonShort } from '../api/mediaApi';
import { EPISODE_MUTATION_KEY, type EpisodeMutationVars } from '../offline/mutations';
import { CheckCircle, ChevronDown, ChevronUp, Trash2, Minus, Plus, Eye } from 'lucide-react';

interface SeasonAccordionProps {
    seriesId: number;
    season: TMDBSeasonShort & { min_rewatch_count?: number };
    defaultOpen: boolean;
}

export const SeasonAccordion: React.FC<SeasonAccordionProps> = ({ seriesId, season, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const api = useApi();
    const queryClient = useQueryClient();
    const { confirm, confirmDialog } = useConfirm();

    const seasonKey = ['tv', seriesId, 'season', season.season_number];

    const { data: seasonData, isLoading } = useQuery({
        queryKey: seasonKey,
        queryFn: () => api.media.getSeasonDetails(seriesId, season.season_number),
        enabled: isOpen,
    });

    // 1. Calcul des épisodes vus
    const watchedCount = seasonData 
        ? seasonData.episodes.filter(ep => ep.is_watched).length 
        : (season.watched_count || 0);
        
    const totalCount = season.episode_count;
    const progressPercentage = totalCount > 0 ? (Math.min(watchedCount, totalCount) / totalCount) * 100 : 0;

    // 2. Calcul du statut de la saison entière (Season Tier)
    let seasonTier = 0;
    if (seasonData?.episodes && seasonData.episodes.length > 0) {
        // Calcul en direct si l'accordéon est ouvert
        const allWatched = seasonData.episodes.every(ep => ep.is_watched);
        if (allWatched) {
            seasonTier = Math.min(...seasonData.episodes.map(ep => (ep.rewatch_count || 0) + 1));
        }
    } else {
        // Utilisation de la propriété de l'API (min_rewatch_count) quand l'accordéon est fermé
        if (watchedCount === totalCount && totalCount > 0) {
            seasonTier = (season.min_rewatch_count || 0) + 1;
        }
    }

    // --- AFFICHAGE OPTIMISTE ---
    // L'action s'affiche tout de suite (même hors ligne) ; le serveur fait foi une fois la synchronisation faite
    const applyEpisodeAction = (ep: EpisodeCustomResponse, action: EpisodeMutationVars['action']): EpisodeCustomResponse => {
        if (action === 'remove') return { ...ep, is_watched: false, rewatch_count: 0 };
        if (action === 'decrement') return { ...ep, rewatch_count: Math.max(0, (ep.rewatch_count || 0) - 1) };
        return ep.is_watched ? { ...ep, rewatch_count: (ep.rewatch_count || 0) + 1 } : { ...ep, is_watched: true };
    };

    const updateCacheOptimistically = (vars: EpisodeMutationVars) => {
        const targets = vars.action === 'watchSeason' ? null : vars.episodeNumber;
        const action = vars.action === 'watchSeason' ? 'watch' : vars.action;

        const updatedSeason = queryClient.setQueryData<SeasonCustomResponse>(seasonKey, old => old && {
            ...old,
            episodes: old.episodes.map(ep => (targets === null || ep.episode_number === targets) ? applyEpisodeAction(ep, action) : ep),
        });

        // Compteur de la saison sur la fiche série (estimé si les épisodes ne sont pas chargés)
        const fallbackCount = vars.action === 'watchSeason' ? season.episode_count : vars.action === 'remove' ? Math.max(0, watchedCount - 1) : watchedCount;
        const newWatchedCount = updatedSeason ? updatedSeason.episodes.filter(ep => ep.is_watched).length : fallbackCount;
        queryClient.setQueryData<MediaCustomResponse>(['tv', seriesId], old => old?.seasons && {
            ...old,
            seasons: old.seasons.map(s => s.season_number === season.season_number ? { ...s, watched_count: newWatchedCount } : s),
        });
    };

    // --- MUTATION (épisode ou saison entière) : fonctionne hors ligne ---
    const episodeMutation = useMutation<unknown, Error, EpisodeMutationVars>({
        mutationKey: EPISODE_MUTATION_KEY,
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: seasonKey });
            updateCacheOptimistically(vars);
        },
    });

    const mutateEpisode = (episodeNumber: number, action: 'watch' | 'remove' | 'decrement') =>
        episodeMutation.mutate({ seriesId, seasonNumber: season.season_number, episodeNumber, action });

    const handleSeasonAction = async (action: 'add' | 'remove' | 'decrement') => {
        triggerVibration([50, 50, 50]);

        if (action === 'add') {
            episodeMutation.mutate({ seriesId, seasonNumber: season.season_number, action: 'watchSeason' });
            return;
        }

        // Retirer / décrémenter : épisode par épisode (il faut donc connaître la liste des épisodes)
        let episodes = seasonData?.episodes;
        if (!episodes && onlineManager.isOnline()) {
            const data = await queryClient.fetchQuery({
                queryKey: seasonKey,
                queryFn: () => api.media.getSeasonDetails(seriesId, season.season_number),
            });
            episodes = data.episodes;
        }
        episodes?.forEach(ep => mutateEpisode(ep.episode_number, action));
    };

    return (
        <div className="mb-3 flex flex-col gap-2">
            {confirmDialog}
            {/* HEADER DE LA SAISON */}
            <div 
                onClick={() => { triggerVibration(10); setIsOpen(!isOpen); }}
                className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-colors hover:bg-zinc-800 relative overflow-hidden"
            >
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-white">
                            {season.season_number === 0 ? 'Spéciaux' : `Saison ${season.season_number}`}
                        </h3>
                        {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-sm font-medium">
                                {Math.min(watchedCount, totalCount)}/{totalCount}
                            </span>
                        </div>
                        
                        {/* CONTRÔLES DE LA SAISON GLOBALE */}
                        {seasonTier > 0 ? (
                            <div 
                                className="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden h-8"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button 
                                    onClick={async () => {
                                        // Retirer toute la saison de l'historique : confirmation (le -1 sur un revisionnage reste direct)
                                        if (seasonTier === 1) {
                                            const confirmed = await confirm({
                                                title: `Décocher toute la saison ${season.season_number} ?`,
                                                message: "Tous les épisodes de cette saison seront retirés de ton historique.",
                                                confirmLabel: 'Décocher',
                                            });
                                            if (!confirmed) return;
                                        }
                                        handleSeasonAction(seasonTier === 1 ? 'remove' : 'decrement');
                                    }}
                                    className="px-2.5 h-full text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                >
                                    {seasonTier === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                                </button>
                                <span className="px-1 text-[11px] font-bold text-emerald-400 font-mono">
                                    x{seasonTier}
                                </span>
                                <button 
                                    onClick={() => handleSeasonAction('add')}
                                    className="px-2.5 h-full text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleSeasonAction('add'); }}
                                className="p-1 rounded-full text-zinc-600 hover:text-emerald-500 border border-zinc-700 transition-colors"
                            >
                                <CheckCircle size={22} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                </div>
            </div>

            {/* LISTE DES ÉPISODES */}
            {isOpen && (
                <div className="flex flex-col gap-2 mt-1 mb-4">
                    {isLoading ? (
                        <div className="text-center py-4 text-zinc-500 animate-pulse text-sm">Chargement des épisodes...</div>
                    ) : seasonData?.episodes ? (
                        seasonData.episodes.map(ep => {
                            const stillUrl = ep.still_path
                                ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                                : 'https://dummyimage.com/300x170/27272a/71717a?text=Pas+d%27image';

                            return (
                                <div key={ep.id} className="flex items-center gap-4 p-2 rounded-xl transition-all hover:bg-zinc-900/50">
                                    <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
                                        <img src={stillUrl} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    
                                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                                        <span className="text-[11px] font-bold text-zinc-400 tracking-wider">
                                            S{ep.season_number.toString().padStart(2, '0')} | E{ep.episode_number.toString().padStart(2, '0')}
                                        </span>
                                        <h4 className="text-sm font-semibold text-white line-clamp-1 mt-0.5">
                                            {ep.name}
                                        </h4>
                                    </div>

                                    {/* CONTRÔLES DE L'ÉPISODE INDIVIDUEL */}
                                    <div className="flex-shrink-0 flex items-center h-9">
                                        {ep.is_watched ? (
                                            <div className="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden h-full">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); triggerVibration(); mutateEpisode(ep.episode_number, ep.rewatch_count === 0 ? 'remove' : 'decrement'); }}
                                                    className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    {ep.rewatch_count === 0 ? <Trash2 size={14} /> : <Minus size={14} />}
                                                </button>
                                                <span className="px-1 text-[11px] font-bold text-emerald-400 font-mono">
                                                    x{(ep.rewatch_count || 0) + 1}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); triggerVibration(); mutateEpisode(ep.episode_number, 'watch'); }}
                                                    className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); triggerVibration(30); mutateEpisode(ep.episode_number, 'watch'); }}
                                                className="h-full px-3 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Eye size={14} /> <span className="hidden sm:inline">Vu</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-zinc-500 text-xs py-4">Aucun épisode trouvé.</div>
                    )}
                </div>
            )}
        </div>
    );
};