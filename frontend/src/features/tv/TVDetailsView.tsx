import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { triggerVibration } from '../../utils/haptics';
import type { UpdateStatusDTO } from '../../api/mediaApi';

export const TVDetailsView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const api = useApi();
    const queryClient = useQueryClient();

    const seriesId = Number(id);
    const mediaType = 'tv';

    // État pour la saison actuellement affichée (Saison 1 par défaut)
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [visibleEpisodesCount, setVisibleEpisodesCount] = useState<number>(30);
    const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(false);

    useEffect(() => {
        setVisibleEpisodesCount(30);
        setIsOverviewExpanded(false);
    }, [selectedSeason]);

    // 1. Récupération des détails globaux de la série
    const { data: series, isLoading, isError } = useQuery({
        queryKey: ['tv', seriesId],
        queryFn: () => api.media.getMediaDetails(seriesId, mediaType),
        enabled: !isNaN(seriesId),
    });

    // 2. Récupération des épisodes de la saison sélectionnée
    const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
        queryKey: ['tv', seriesId, 'season', selectedSeason],
        queryFn: () => api.media.getSeasonDetails(seriesId, selectedSeason),
        enabled: !isNaN(seriesId) && !!series,
    });

    const watchedEpisodes = seasonData?.episodes?.filter((ep: any) => ep.is_watched) ?? [];
    const isAllWatched = watchedEpisodes.length === seasonData?.episodes?.length;

    // 3. Récupération des séries similaires
    const { data: similarSeries, isLoading: isSimilarLoading } = useQuery({
        queryKey: ['tv', 'similar', seriesId],
        queryFn: () => api.media.getSimilarSeries(seriesId),
        enabled: !isNaN(seriesId) && !!series,
    });

    const watchAllMutation = useMutation({
        mutationFn: () => api.media.watchAllEpisodesInSeason(seriesId, selectedSeason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId, 'season', selectedSeason] });
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
        }
    });

    // 4. Mutation pour le statut global (Watchlist, Favoris)
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

    // 5. Mutation pour ajouter, revoir ou supprimer un épisode
    const episodeMutation = useMutation({
        mutationFn: async (variables: { episodeNumber: number; action: 'add' | 'remove' | 'decrement' }) => {
            if (variables.action === 'remove') {
                return api.media.removeEpisode(seriesId, selectedSeason, variables.episodeNumber);
            }
            if (variables.action === 'decrement') {
                return api.media.decrementEpisode(seriesId, selectedSeason, variables.episodeNumber);
            }
            return api.media.watchEpisode(seriesId, selectedSeason, variables.episodeNumber);
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['tv', seriesId, 'season', selectedSeason] });
            const previousSeason = queryClient.getQueryData(['tv', seriesId, 'season', selectedSeason]);

            queryClient.setQueryData(['tv', seriesId, 'season', selectedSeason], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    episodes: old.episodes.map((ep: any) => {
                        if (ep.episode_number === variables.episodeNumber) {

                            if (variables.action === 'remove') {
                                return { ...ep, is_watched: false, rewatch_count: 0 };
                            } else if (variables.action === 'decrement') {
                                return { ...ep, rewatch_count: Math.max(0, (ep.rewatch_count || 0) - 1) };
                            } else {
                                // 'add' : on passe is_watched à true et on incrémente le rewatch_count
                                return { ...ep, is_watched: true, rewatch_count: ep.is_watched ? (ep.rewatch_count || 0) + 1 : 0 };
                            }

                        }
                        return ep;
                    })
                };
            });

            return { previousSeason };
        },
        onError: (err, _, context) => {
            if (context?.previousSeason) {
                queryClient.setQueryData(['tv', seriesId, 'season', selectedSeason], context.previousSeason);
            }
            console.error("Erreur de mutation d'épisode :", err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId, 'season', selectedSeason] });
            queryClient.invalidateQueries({ queryKey: ['tv', seriesId] });
        }
    });

    if (isLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">Chargement de la série...</div>;
    if (isError || !series) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    // Formatages visuels
    const backdropUrl = series.backdrop_path ? `https://image.tmdb.org/t/p/original${series.backdrop_path}` : '';
    const year = series.first_air_date ? new Date(series.first_air_date).getFullYear() : 'N/A';

    // Calcul de la durée moyenne d'un épisode (les séries renvoient souvent un tableau)
    const safeRuntime = series.episode_run_time && series.episode_run_time.length > 0 ? series.episode_run_time[0] : 0;
    const runtimeHours = Math.floor(safeRuntime / 60);
    const runtimeMinutes = safeRuntime % 60;
    const formattedRuntime = safeRuntime > 0
        ? (runtimeHours > 0 ? `${runtimeHours}h ${runtimeMinutes.toString().padStart(2, '0')}m` : `${runtimeMinutes}m`)
        : '';

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* HEADER BACKGROUND IMAGE */}
            <div className="relative w-full aspect-video sm:aspect-[21/9] bg-zinc-900">
                {backdropUrl && <img src={backdropUrl} alt={series.name} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>

                {/* Bouton Retour */}
                <button
                    onClick={() => { triggerVibration(); navigate(-1); }}
                    className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition aspect-square"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>

                {/* Bouton Cœur (Favoris) */}
                {series.status_local && series.status_local !== 'not_tracked' && (
                    <button
                        onClick={() => {
                            triggerVibration([30, 100, 30]);
                            globalMutation.mutate({ newStatus: series.status_local, isFavorite: !series.is_favorite });
                        }}
                        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full text-white transition bg-black/40 hover:bg-black/60 aspect-square"
                    >
                        {series.is_favorite ? '❤️' : '🤍'}
                    </button>
                )}
            </div>

            {/* CONTENU DE LA FICHE */}
            <div className="px-4 -mt-10 sm:-mt-16 relative z-10 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
                    {series.name}
                </h1>

                {/* Statistiques rapides sous le titre */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-400 mb-6">
                    <span className="bg-zinc-800/80 px-2 py-1 rounded-md text-zinc-200">{year}</span>
                    {formattedRuntime && <span>⏱ ~{formattedRuntime}/ép.</span>}
                    <span>Saisons : {series.number_of_seasons}</span>
                    <span>Épisodes : {series.number_of_episodes}</span>
                    {series.vote_average !== undefined && series.vote_average > 0 && (
                        <span className="text-amber-400">⭐️ {series.vote_average.toFixed(1)}/10</span>
                    )}

                    {/* Dates de visionnage */}
                    {series.status_local && series.status_local !== 'not_tracked' && series.status_local !== 'watchlist' && series.created_at && (
                        <span className="ml-auto bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
                            Début : {new Date(series.created_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                    {series.status_local && series.status_local !== 'not_tracked' && series.status_local !== 'watchlist' && series.updated_at && series.updated_at !== series.created_at && (
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
                            Dernier : {new Date(series.updated_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                </div>

                {/* BOUTONS D'ACTION (Watchlist globale) */}
                <div className="mb-8">
                    <button
                        onClick={() => {
                            const isTracked = series.status_local && series.status_local !== 'not_tracked';
                            const newStatus = isTracked ? 'not_tracked' : 'watchlist';
                            triggerVibration(isTracked ? [50, 80, 20] : [20, 80, 50]);
                            globalMutation.mutate({ newStatus, isFavorite: series.is_favorite });
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${series.status_local && series.status_local !== 'not_tracked'
                            ? 'bg-purple-500 text-black hover:bg-purple-400'
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                            }`}
                    >
                        {series.status_local && series.status_local !== 'not_tracked'
                            ? `➖ Suivi`
                            : '➕ Suivre la série'
                        }
                    </button>
                </div>

                {/* Genres */}
                {series.genres && series.genres.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-3">Genres</h2>
                        <div className="flex flex-wrap gap-2">
                            {series.genres.map(genre => (
                                <span key={genre.id} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tagline & Synopsis */}
                {series.tagline && (
                    <p className="italic text-zinc-400 text-sm mb-4">"{series.tagline}"</p>
                )}
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-2">Synopsis</h2>
                    <p className="text-zinc-300 text-sm leading-relaxed opacity-90">{series.overview || "Aucun synopsis disponible."}</p>
                </div>

                {/* Bloc Informations : Statut */}
                <div className="grid grid-cols-2 gap-4 mb-8 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50">
                    <div>
                        <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Statut</h3>
                        <p className="text-zinc-200 text-sm font-medium">{series.status || 'Inconnu'}</p>
                    </div>
                    <div>
                        <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Dernière diffusion</h3>
                        <p className="text-zinc-200 text-sm font-medium">
                            {/* Note: last_air_date n'est pas dans tous les retours simplifiés, on fallback sur l'année */}
                            {year}
                        </p>
                    </div>
                </div>

                {/* Studios de Production */}
                {series.production_companies && series.production_companies.length > 0 && (
                    <div className="mb-10">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-3">Réseaux & Studios</h2>
                        <div className="flex flex-wrap gap-3">
                            {series.production_companies.map(company => (
                                <div key={company.id} className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-800">
                                    {company.logo_path && (
                                        <img
                                            src={`https://image.tmdb.org/t/p/w200${company.logo_path}`}
                                            alt={company.name}
                                            className="h-5 bg-zinc-200 p-0.5 rounded-sm"
                                        />
                                    )}
                                    <span className="text-xs font-medium text-zinc-300">{company.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- NAVIGATION DES SAISONS --- */}
                <div className="border-t border-zinc-900 pt-6 mb-4">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-3">Saisons</h2>
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none snap-x">
                        {series.seasons && series.seasons.length > 0 ? (
                            // On trie le tableau : les saisons (1, 2, 3...) d'abord, et la 0 (Spéciaux) à la fin
                            [...series.seasons]
                                .sort((a, b) => {
                                    if (a.season_number === 0) return 1;  // La saison 0 va à la fin
                                    if (b.season_number === 0) return -1; // La saison 0 reste à la fin
                                    return a.season_number - b.season_number; // Ordre croissant normal
                                })
                                .map((season) => (
                                    <button
                                        key={season.id}
                                        onClick={() => { triggerVibration(10); setSelectedSeason(season.season_number); }}
                                        className={`px-4 py-2 text-xs font-semibold rounded-xl flex-shrink-0 snap-start transition-all border ${selectedSeason === season.season_number
                                            ? 'bg-purple-500 text-black border-purple-500 shadow-md'
                                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                            }`}
                                    >
                                        {season.season_number === 0 ? 'Spéciaux' : `Saison ${season.season_number}`}
                                    </button>
                                ))
                        ) : (
                            // Fallback de sécurité si 'seasons' n'est pas dispo
                            Array.from({ length: series.number_of_seasons || 1 }).map((_, i) => {
                                const seasonNum = i + 1;
                                return (
                                    <button
                                        key={seasonNum}
                                        onClick={() => { triggerVibration(10); setSelectedSeason(seasonNum); }}
                                        className={`px-4 py-2 text-xs font-semibold rounded-xl flex-shrink-0 snap-start transition-all border ${selectedSeason === seasonNum
                                            ? 'bg-purple-500 text-black border-purple-500 shadow-md'
                                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                            }`}
                                    >
                                        Saison {seasonNum}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* --- CONTENU DE LA SAISON (En-tête + Épisodes) --- */}
                {isSeasonLoading ? (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-32 bg-zinc-900 rounded-xl mb-6" /> {/* Placeholder Header Saison */}
                        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-zinc-900 rounded-xl" />)}
                    </div>
                ) : seasonData ?
                    (
                        <div>
                            <div className="flex gap-4 mb-6 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
                                {seasonData.poster_path && (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w200${seasonData.poster_path}`}
                                        alt={seasonData.name}
                                        className="w-20 sm:w-24 rounded-lg object-cover shadow-md flex-shrink-0 border border-zinc-800"
                                    />
                                )}
                                <div className="flex flex-col justify-center">
                                    <h3 className="text-lg font-bold text-white mb-1">{seasonData.name}</h3>
                                    {seasonData.vote_average > 0 && (
                                        <div className="text-amber-400 text-xs font-bold mb-2">
                                            ⭐️ {seasonData.vote_average.toFixed(1)}/10
                                        </div>
                                    )}

                                    {seasonData.overview ? (
                                        <div>
                                            <p className={`text-xs text-zinc-400 leading-relaxed transition-all ${isOverviewExpanded ? '' : 'line-clamp-3'}`}>
                                                {seasonData.overview}
                                            </p>
                                            {seasonData.overview.length > 150 && (
                                                <button
                                                    onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                                                    className="text-[10px] text-purple-400 hover:text-purple-300 font-bold mt-1.5 uppercase tracking-wider"
                                                >
                                                    {isOverviewExpanded ? 'Réduire' : 'Lire la suite...'}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zinc-600 italic">Aucun résumé pour cette saison.</p>
                                    )}

                                    {!isAllWatched && seasonData.episodes && (
                                        <button
                                            onClick={() => {
                                                triggerVibration([100, 50, 100]);
                                                watchAllMutation.mutate();
                                            }}
                                            className="mt-3 flex items-center gap-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-emerald-500/20 transition-all"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            Tout marquer comme vu ({seasonData.episodes.length - watchedEpisodes.length} restants)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 📝 LISTE DES ÉPISODES */}
                            <div className="flex flex-col gap-2.5">
                                {seasonData.episodes && seasonData.episodes.slice(0, visibleEpisodesCount).map((ep: any) => {
                                    const stillUrl = ep.still_path
                                        ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                                        : 'https://dummyimage.com/300x170/27272a/71717a?text=Pas+d%27image';

                                    return (
                                        <div
                                            key={ep.id}
                                            className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all hover:bg-zinc-900/80"
                                        >
                                            {/* IMAGE ET INFOS DE L'ÉPISODE RESTENT ICI... (Garde ton code existant pour la miniature et le titre) */}
                                            <div className="w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 bg-zinc-950 rounded-lg overflow-hidden relative border border-zinc-800/50">
                                                <img src={stillUrl} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                                                {ep.runtime > 0 && (
                                                    <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                        {ep.runtime}m
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-grow min-w-0 flex flex-col justify-center">
                                                <h3 className="text-sm font-bold text-zinc-200 line-clamp-1">
                                                    S{ep.season_number == 0 ? 'pecial' : ep.season_number} | E{ep.episode_number}.   {ep.name || 'Épisode sans titre'}
                                                </h3>
                                                <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                                                    {ep.air_date ? new Date(ep.air_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date inconnue'}
                                                </p>
                                                {ep.overview && (
                                                    <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1 sm:line-clamp-2">
                                                        {ep.overview}
                                                    </p>
                                                )}
                                            </div>

                                            {/* 👇 GESTION DU BOUTON POUBELLE vs MOINS 👇 */}
                                            <div className="flex-shrink-0 flex items-center">
                                                {ep.is_watched ? (
                                                    <div className="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden h-9">

                                                        {/* BOUTON GAUCHE (Poubelle si x1, Moins si > x1) */}
                                                        <button
                                                            onClick={() => {
                                                                triggerVibration();
                                                                if (ep.rewatch_count === 0) {
                                                                    episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'remove' });
                                                                } else {
                                                                    episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'decrement' });
                                                                }
                                                            }}
                                                            className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 hover:text-white transition"
                                                        >
                                                            {ep.rewatch_count === 0 ? (
                                                                // Icône Poubelle
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                            ) : (
                                                                // Icône Moins
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                            )}
                                                        </button>

                                                        {/* COMPTEUR */}
                                                        <span className="px-1 text-[11px] font-bold text-emerald-400 font-mono">
                                                            x{(ep.rewatch_count || 0) + 1}
                                                        </span>

                                                        {/* BOUTON DROITE (Plus) */}
                                                        <button
                                                            onClick={() => { triggerVibration(20); episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'add' }); }}
                                                            className="px-2.5 h-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/20 hover:text-white transition"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { triggerVibration(30); episodeMutation.mutate({ episodeNumber: ep.episode_number, action: 'add' }); }}
                                                        className="h-9 w-10 sm:w-auto sm:px-4 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        👁️ <span className="hidden sm:inline">Vu</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-zinc-500 text-xs py-6">Impossible de charger la saison.</div>
                    )}

                {/* --- RECOMMANDATIONS SIMILAIRES --- */}
                <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">Séries similaires</h2>
                    {isSimilarLoading ? (
                        <div className="flex gap-3 overflow-x-hidden">
                            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="w-28 h-40 bg-zinc-900 rounded-xl animate-pulse flex-shrink-0" />)}
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
                            Aucune recommandation disponible pour cette série.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};