import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import { CheckCircle, ChevronDown, ChevronUp, Trash2, Minus, Plus, Eye } from 'lucide-react';

interface SeasonAccordionProps {
    seriesId: number;
    season: any;
    defaultOpen: boolean;
}

export const SeasonAccordion: React.FC<SeasonAccordionProps> = ({ seriesId, season, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [isSeasonMutating, setIsSeasonMutating] = useState(false);
    const api = useApi();
    const queryClient = useQueryClient();

    // Fetch À LA DEMANDE
    const { data: seasonData, isLoading } = useQuery({
        queryKey: ['tv', seriesId, 'season', season.season_number],
        queryFn: () => api.media.getSeasonDetails(seriesId, season.season_number),
        enabled: isOpen,
    });

    // Calcul intelligent : on utilise les données fetchées si dispo, sinon le pré-calcul du backend
    const watchedCount = seasonData 
        ? seasonData.episodes.filter((ep: any) => ep.is_watched).length 
        : (season.watched_count || 0);
        
    const totalCount = season.episode_count;
    const progressPercentage = totalCount > 0 ? (Math.min(watchedCount, totalCount) / totalCount) * 100 : 0;

    // Calcul du "Tier" de la saison (combien de fois elle a été vue ENTIEREMENT)
    let seasonTier = 0;
    if (seasonData?.episodes && seasonData.episodes.length > 0) {
        seasonTier = Math.min(...seasonData.episodes.map((ep: any) => ep.is_watched ? (ep.rewatch_count || 0) + 1 : 0));
    } else {
        seasonTier = totalCount > 0 ? Math.floor((season.watched_count || 0) / totalCount) : 0;
    }

    // --- MUTATION GLOBALE (Saison) ---
    const handleSeasonAction = async (action: 'add' | 'remove' | 'decrement') => {
        if (isSeasonMutating) return;
        setIsSeasonMutating(true);
        triggerVibration([50, 50, 50]);
        
        try {
            if (action === 'add') {
                // Ta route backend optimisée pour tout cocher
                await api.media.watchAllEpisodesInSeason(seriesId, season.season_number);
            } else {
                // Pour décrémenter/supprimer, on doit appliquer l'action sur chaque épisode
                let eps = seasonData?.episodes;
                if (!eps) {
                    const data = await queryClient.fetchQuery({
                        queryKey: ['tv', seriesId, 'season', season.season_number],
                        queryFn: () => api.media.getSeasonDetails(seriesId, season.season_number)
                    });
                    eps = data.episodes;
                }
                if (eps) {
                    const promises = eps.map((ep: any) => {
                        if (action === 'remove') return api.media.removeEpisode(seriesId, season.season_number, ep.episode_number);
                        return api.media.decrementEpisode(seriesId, season.season_number, ep.episode_number);
                    });
                    await Promise.all(promises);
                }
            }
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId, 'season', season.season_number] });
        } catch (err) {
            console.error("Erreur action saison:", err);
        } finally {
            setIsSeasonMutating(false);
        }
    };

    // --- MUTATION INDIVIDUELLE (Épisode) ---
    const episodeMutation = useMutation({
        mutationFn: async (variables: { episodeNumber: number; action: 'add' | 'remove' | 'decrement' }) => {
            if (variables.action === 'remove') return api.media.removeEpisode(seriesId, season.season_number, variables.episodeNumber);
            if (variables.action === 'decrement') return api.media.decrementEpisode(seriesId, season.season_number, variables.episodeNumber);
            return api.media.watchEpisode(seriesId, season.season_number, variables.episodeNumber);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId, 'season', season.season_number] });
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
        }
    });

    return (
        <div className="mb-3 flex flex-col gap-2">
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
                        <span className="text-zinc-400 text-sm font-medium">
                            {Math.min(watchedCount, totalCount)}/{totalCount}
                        </span>
                        
                        {/* CONTRÔLES DE LA SAISON GLOBALE */}
                        {isSeasonMutating ? (
                            <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin"></div>
                        ) : seasonTier > 0 ? (
                            <div 
                                className="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden h-8"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button 
                                    onClick={() => handleSeasonAction(seasonTier === 1 ? 'remove' : 'decrement')}
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
                        seasonData.episodes.map((ep: any) => {
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
                                                    onClick={(e) => { e.stopPropagation(); triggerVibration(); episodeMutation.mutate({ episodeNumber: ep.episode_number, action: ep.rewatch_count === 0 ? 'remove' : 'decrement' }); }}
                                                    className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    {ep.rewatch_count === 0 ? <Trash2 size={14} /> : <Minus size={14} />}
                                                </button>
                                                <span className="px-1 text-[11px] font-bold text-emerald-400 font-mono">
                                                    x{(ep.rewatch_count || 0) + 1}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); triggerVibration(); episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'add' }); }}
                                                    className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); triggerVibration(30); episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'add' }); }}
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