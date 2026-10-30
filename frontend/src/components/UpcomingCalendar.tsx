import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle, Film, Popcorn, Sparkles, Flag, Clapperboard, MonitorPlay } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import type { CalendarItem, CalendarResponse } from '../api/mediaApi';
import { EPISODE_MUTATION_KEY, type EpisodeMutationVars } from '../offline/mutations';
import { OfflineNotice } from '../offline/OfflineNotice';

interface UpcomingCalendarProps {
    mediaType: 'movie' | 'tv';
}

// Plusieurs épisodes d'une même série le même jour (ex: saison complète sur Netflix) = une seule ligne
interface CalendarEntry {
    key: string;
    main: CalendarItem;
    episodes: CalendarItem[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

const RELEASE_LABELS: Record<string, string> = {
    theatrical: 'Au cinéma',
    digital: 'En streaming / VOD',
    physical: 'En DVD / Blu-ray',
    tv: 'À la télé',
};

// Les dates sont des jours "calendaires" (YYYY-MM-DD) : on les compare à midi pour éviter les décalages de fuseau
const parseDay = (date: string) => new Date(`${date}T12:00:00`);
const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

const dayLabel = (date: string, today: string) => {
    const diff = daysBetween(today, date);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    if (diff === -1) return 'Hier';
    const label = parseDay(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const groupEntries = (items: CalendarItem[]): CalendarEntry[] => {
    const entries = new Map<string, CalendarEntry>();
    for (const item of items) {
        const key = item.type === 'episode' ? `ep-${item.id}-${item.season_number}` : `movie-${item.id}`;
        const entry = entries.get(key);
        if (entry) {
            entry.episodes.push(item);
        } else {
            entries.set(key, { key, main: item, episodes: [item] });
        }
    }
    return [...entries.values()];
};

export const UpcomingCalendar: React.FC<UpcomingCalendarProps> = ({ mediaType }) => {
    const api = useApi();
    const queryClient = useQueryClient();

    const { data, isLoading, isError, fetchStatus } = useQuery({
        queryKey: ['calendar', mediaType],
        // Séries : 3 mois devant soi / Films : les sorties sont annoncées bien plus tôt
        queryFn: () => api.media.getCalendar(mediaType, mediaType === 'tv' ? 90 : 365),
        staleTime: 1000 * 60 * 15,
    });

    // Cocher un épisode : affichage immédiat, mis en file d'attente si hors ligne
    const watchMutation = useMutation<unknown, Error, EpisodeMutationVars>({
        mutationKey: EPISODE_MUTATION_KEY,
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: ['calendar', mediaType] });
            queryClient.setQueryData<CalendarResponse>(['calendar', mediaType], old => old && {
                ...old,
                days: old.days.map(day => ({
                    ...day,
                    items: day.items.map(item =>
                        item.type === 'episode' && item.id === vars.seriesId && item.season_number === vars.seasonNumber && item.episode_number === vars.episodeNumber
                            ? { ...item, is_watched: true }
                            : item
                    ),
                })),
            });
        },
    });

    const { recent, upcoming, weekStrip } = useMemo(() => {
        if (!data) return { recent: [], upcoming: [], weekStrip: [] };

        // "Sorti récemment" : uniquement ce qu'il reste à voir
        const recent = data.days
            .filter(day => day.date < data.today)
            .map(day => ({ ...day, entries: groupEntries(day.items.filter(item => item.type === 'movie' || !item.is_watched)) }))
            .filter(day => day.entries.length > 0)
            .reverse();

        const upcoming = data.days
            .filter(day => day.date >= data.today)
            .map(day => ({ ...day, entries: groupEntries(day.items) }));

        const datesWithItems = new Set(upcoming.map(day => day.date));
        const weekStrip = Array.from({ length: 14 }, (_, i) => {
            const date = new Date(parseDay(data.today).getTime() + i * DAY_MS);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return { key, date, hasItems: datesWithItems.has(key) };
        });

        return { recent, upcoming, weekStrip };
    }, [data]);

    if (isLoading && fetchStatus === 'paused') return <OfflineNotice what="Ce calendrier" />;

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex gap-2 overflow-hidden">
                    {Array.from({ length: 7 }).map((_, i) => <div key={i} className="w-12 h-16 bg-zinc-900 rounded-xl animate-pulse flex-shrink-0" />)}
                </div>
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />)}
            </div>
        );
    }
    if (isError || !data) return <div className="text-red-500 text-center pt-10">Erreur lors du chargement du calendrier.</div>;

    const scrollToDay = (date: string) => {
        triggerVibration(10);
        document.getElementById(`calendar-${mediaType}-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const renderEntry = (entry: CalendarEntry, isPast: boolean) => {
        const { main, episodes } = entry;
        const isMovie = main.type === 'movie';
        const daysLeft = daysBetween(data.today, main.air_date);
        const first = episodes[0];
        const last = episodes[episodes.length - 1];
        const hasFinale = episodes.some(ep => ep.episode_type === 'finale');
        const isFullSeason = episodes.length > 1 && first.is_premiere && hasFinale;
        const unwatched = episodes.filter(ep => !ep.is_watched);
        const canMarkWatched = !isMovie && episodes.length === 1 && !main.is_watched && daysLeft <= 0;

        return (
            <div
                key={entry.key}
                className={`flex items-center gap-3 bg-zinc-900/60 border rounded-xl p-2 pr-3 transition-all hover:border-zinc-700 ${isPast ? 'border-amber-500/20' : 'border-zinc-800/40'}`}
            >
                <Link to={`/${isMovie ? 'movie' : 'tv'}/${main.id}`} className="flex items-center gap-3 flex-grow min-w-0">
                    <div className="w-14 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-zinc-950">
                        {main.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w154${main.poster_path}`} alt={main.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700"><Film size={16} /></div>
                        )}
                    </div>

                    <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">{main.title}</h3>

                        {isMovie ? (
                            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                                {main.release_type === 'theatrical' ? <Clapperboard size={12} /> : <MonitorPlay size={12} />}
                                {RELEASE_LABELS[main.release_type || ''] || 'Sortie'}
                                {!main.is_french_date && <span className="text-zinc-600">· date internationale</span>}
                            </p>
                        ) : (
                            <>
                                <p className="text-xs font-medium text-purple-400 mt-0.5">
                                    {episodes.length > 1
                                        ? `S${first.season_number} · E${first.episode_number} → E${last.episode_number}`
                                        : `S${main.season_number} | E${main.episode_number}`}
                                    {episodes.length === 1 && main.episode_name && (
                                        <span className="text-zinc-400 font-normal"> · {main.episode_name}</span>
                                    )}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {isFullSeason ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400">Saison complète</span>
                                    ) : (
                                        <>
                                            {first.is_premiere && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 flex items-center gap-1"><Sparkles size={9} /> Nouvelle saison</span>
                                            )}
                                            {hasFinale && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-400 flex items-center gap-1"><Flag size={9} /> Final</span>
                                            )}
                                        </>
                                    )}
                                    {main.network && <span className="text-[10px] text-zinc-500">{main.network}</span>}
                                    {isPast && episodes.length > 1 && (
                                        <span className="text-[10px] text-amber-400">{unwatched.length} à voir</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </Link>

                {canMarkWatched ? (
                    <button
                        onClick={() => {
                            triggerVibration([20, 80, 20]);
                            watchMutation.mutate({ seriesId: main.id, seasonNumber: main.season_number!, episodeNumber: main.episode_number!, action: 'watch' });
                        }}
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-zinc-800/80 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-500 rounded-full transition-all border border-zinc-700/50 disabled:opacity-50"
                    >
                        <CheckCircle size={20} strokeWidth={2.5} />
                    </button>
                ) : daysLeft > 0 ? (
                    <div className="flex-shrink-0 flex items-center gap-1 bg-purple-500 text-black px-1.5 py-0.5 rounded text-[11px] font-black">
                        <CalendarClock size={12} />
                        <span>J-{daysLeft}</span>
                    </div>
                ) : null}
            </div>
        );
    };

    const isEmpty = recent.length === 0 && upcoming.length === 0;

    return (
        <div className="flex flex-col gap-8 max-w-3xl mx-auto">
            {/* BANDEAU DES 14 PROCHAINS JOURS */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
                {weekStrip.map(({ key, date, hasItems }) => {
                    const isToday = key === data.today;
                    return (
                        <button
                            key={key}
                            onClick={() => hasItems && scrollToDay(key)}
                            className={`w-12 flex-shrink-0 flex flex-col items-center py-2 rounded-xl border transition-all ${isToday
                                ? 'bg-purple-500 text-black border-purple-500'
                                : hasItems
                                    ? 'bg-zinc-900 border-zinc-700 text-white'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-600'}`}
                        >
                            <span className="text-[9px] font-bold uppercase">{date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
                            <span className="text-lg font-black leading-tight">{date.getDate()}</span>
                            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${hasItems ? (isToday ? 'bg-black' : 'bg-purple-500') : 'bg-transparent'}`} />
                        </button>
                    );
                })}
            </div>

            {isEmpty && (
                <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto text-center">
                    <Popcorn className="w-12 h-12 text-zinc-700 mb-4" />
                    <h2 className="text-lg font-bold mb-1">Rien à l'horizon</h2>
                    <p className="text-sm text-zinc-500">
                        {mediaType === 'tv'
                            ? "Aucun nouvel épisode annoncé pour tes séries dans les 3 prochains mois."
                            : "Aucune sortie annoncée pour les films de ta watchlist."}
                    </p>
                </div>
            )}

            {/* SORTI RÉCEMMENT (7 derniers jours, pas encore vu) */}
            {recent.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-amber-400 mb-4 uppercase tracking-wider">Sorti récemment</h2>
                    <div className="flex flex-col gap-4">
                        {recent.map(day => (
                            <div key={day.date}>
                                <h3 className="text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">{dayLabel(day.date, data.today)}</h3>
                                <div className="flex flex-col gap-2">{day.entries.map(entry => renderEntry(entry, true))}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* À VENIR */}
            {upcoming.map(day => {
                const diff = daysBetween(data.today, day.date);
                return (
                    <div key={day.date} id={`calendar-${mediaType}-${day.date}`} className="scroll-mt-48">
                        <h3 className="text-sm font-bold text-purple-400 mb-3 uppercase tracking-wider flex items-baseline gap-2">
                            {dayLabel(day.date, data.today)}
                            {diff > 1 && <span className="text-[10px] text-zinc-500 normal-case tracking-normal font-medium">dans {diff} jours</span>}
                        </h3>
                        <div className="flex flex-col gap-2">{day.entries.map(entry => renderEntry(entry, false))}</div>
                    </div>
                );
            })}
        </div>
    );
};
