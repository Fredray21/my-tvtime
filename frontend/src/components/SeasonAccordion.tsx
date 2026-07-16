import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SeasonAccordionProps {
    seriesId: number;
    season: any; // Remplace 'any' par ton type Season si tu l'as
    defaultOpen: boolean;
}

export const SeasonAccordion: React.FC<SeasonAccordionProps> = ({ seriesId, season, defaultOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const api = useApi();
    const queryClient = useQueryClient();

    // Fetch À LA DEMANDE
    const { data: seasonData, isLoading } = useQuery({
        queryKey: ['tv', seriesId, 'season', season.season_number],
        queryFn: () => api.media.getSeasonDetails(seriesId, season.season_number),
        enabled: isOpen,
    });

    const watchedEpisodes = seasonData?.episodes?.filter((ep: any) => ep.is_watched) ?? [];
    const watchedCount = watchedEpisodes.length;
    const totalCount = season.episode_count;
    const isAllWatched = watchedCount === totalCount && totalCount > 0;
    const progressPercentage = totalCount > 0 ? (watchedCount / totalCount) * 100 : 0;

    const watchAllMutation = useMutation({
        mutationFn: () => api.media.watchAllEpisodesInSeason(seriesId, season.season_number),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId, 'season', season.season_number] });
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
        }
    });

    const episodeMutation = useMutation({
        mutationFn: async (variables: { episodeNumber: number; action: 'add' | 'remove' }) => {
            if (variables.action === 'remove') {
                return api.media.removeEpisode(seriesId, season.season_number, variables.episodeNumber);
            }
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
                className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-colors hover:bg-zinc-800"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-white">
                            {season.season_number === 0 ? 'Spéciaux' : `Saison ${season.season_number}`}
                        </h3>
                        {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className="text-zinc-400 text-sm font-medium">
                            {watchedCount}/{totalCount}
                        </span>
                        
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                triggerVibration([50, 50, 50]);
                                watchAllMutation.mutate();
                            }}
                            className={`p-1 rounded-full transition-all ${
                                isAllWatched 
                                ? 'text-emerald-500 bg-emerald-500/20' 
                                : 'text-zinc-600 hover:text-emerald-500 border border-zinc-700'
                            }`}
                        >
                            <CheckCircle size={22} className={isAllWatched ? "fill-emerald-500 text-black" : ""} />
                        </button>
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
                                    <div className="w-28 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
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

                                    <button 
                                        onClick={() => {
                                            triggerVibration(20);
                                            episodeMutation.mutate({ 
                                                episodeNumber: ep.episode_number, 
                                                action: ep.is_watched ? 'remove' : 'add' 
                                            });
                                        }}
                                        className={`flex-shrink-0 p-2 rounded-full transition-all ${
                                            ep.is_watched 
                                            ? 'text-emerald-500 bg-emerald-500/20' 
                                            : 'text-zinc-600 hover:text-emerald-500'
                                        }`}
                                    >
                                        <CheckCircle size={24} className={ep.is_watched ? "fill-emerald-500 text-black" : ""} />
                                    </button>
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