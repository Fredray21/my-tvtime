import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, CheckCircle, Eye, CalendarClock, Loader } from 'lucide-react';
import { triggerVibration } from '../utils/haptics';

interface MediaCardProps {
    item: any;
    fallbackMediaType?: 'movie' | 'tv' | 'person';
    layout?: 'card' | 'list';
    isUpcoming?: boolean;
    onStatusChange?: (mediaId: number, newStatus: 'watchlist' | 'watched') => Promise<void> | void;
    onWatchEpisode?: (id: number, season: number, episode: number) => Promise<void> | void;
}

type TMDBSeason = {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
    vote_average: number;
    watched_count: number;
    max_episode_watched?: number
};

export const MediaCard: React.FC<MediaCardProps> = ({
    item,
    fallbackMediaType = 'movie',
    layout = 'card',
    isUpcoming = false,
    onStatusChange,
    onWatchEpisode
}) => {
    const title = item.title || item.name || 'Sans titre';
    const imagePath = item.poster_path || item.profile_path;
    const imageUrl = imagePath
        ? `https://image.tmdb.org/t/p/w500${imagePath}`
        : 'https://dummyimage.com/500x750?text=No+Poster';

    const rawDate = item.release_date || item.first_air_date;
    const year = rawDate ? new Date(rawDate).getFullYear() : null;

    const mediaType = item.media_type || fallbackMediaType;
    const isPerson = mediaType === 'person';
    const targetUrl = `/${mediaType}/${item.id || item.tmdb_id}`;

    const getDaysLeft = () => {
        const targetDateStr = item.next_episode_to_air?.air_date || item.release_date;
        if (!targetDateStr) return null;

        const targetDate = new Date(targetDateStr);
        const today = new Date();
        targetDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return days > 0 ? days : null;
    };
    const daysLeft = getDaysLeft();

    const [swipeOffset, setSwipeOffset] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);

    let nextSeason = item.next_season_number;
    let nextEpisode = item.next_episode_number;

    if (isUpcoming && item.next_episode_to_air) {
        // 1. Par défaut, on cible l'épisode qui va sortir
        nextSeason = item.next_episode_to_air.season_number;
        nextEpisode = item.next_episode_to_air.episode_number;

        // 2. On cherche les infos de cette saison spécifique
        const upcomingSeasonData = item.seasons?.find((s: TMDBSeason) => s.season_number === nextSeason);

        if (upcomingSeasonData) {
            // On récupère le numéro le plus élevé (avec un fallback sur watched_count au cas où)
            const highestWatched = upcomingSeasonData.max_episode_watched || upcomingSeasonData.watched_count || 0;

            // 3. L'utilisateur a déjà vu cet épisode (ou plus)
            if (highestWatched >= nextEpisode) {
                // Le prochain est strictement celui APRÈS le plus grand numéro vu
                nextEpisode = highestWatched + 1;

                // 4. On dépasse la fin de cette saison
                if (nextEpisode > upcomingSeasonData.episode_count) {

                    // On vérifie si la saison SUIVANTE existe vraiment
                    const hasNextSeason = item.seasons?.some((s: TMDBSeason) => s.season_number === nextSeason + 1);

                    if (hasNextSeason) {
                        nextSeason += 1;
                        nextEpisode = 1;
                    } else {
                        // Aucune saison suivante : on met à 0 pour cacher l'affichage et désactiver le clic
                        nextEpisode = 0;
                    }
                }
            }
        }
    }

    const handleAction = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            if (mediaType === 'tv' && nextEpisode > 0 && onWatchEpisode) {
                await onWatchEpisode(item.id, nextSeason, nextEpisode);
            } else if (onStatusChange) {
                await onStatusChange(item.id || item.tmdb_id, 'watched');
            }
        } catch (error) {
            console.error("Erreur lors de l'action :", error);
        } finally {
            setIsProcessing(false);
            setSwipeOffset(0);
            setIsDragging(false);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (layout !== 'list' || !onStatusChange || isPerson || item.status_local === 'watched' || isProcessing) return;
        setTouchStartX(e.touches[0].clientX);
        setTouchStartY(e.touches[0].clientY);
        setIsDragging(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartX || !touchStartY || layout !== 'list' || isProcessing) return;
        const xDiff = e.touches[0].clientX - touchStartX;
        const yDiff = e.touches[0].clientY - touchStartY;

        if (!isDragging) {
            if (Math.abs(xDiff) > Math.abs(yDiff) && xDiff > 0) {
                setIsDragging(true);
            } else {
                return;
            }
        }

        if (xDiff > 0) {
            const offset = xDiff > 80 ? 80 + (xDiff - 80) * 0.2 : xDiff;
            setSwipeOffset(offset);
        }
    };

    const handleTouchEnd = () => {
        if (isProcessing) return;

        if (swipeOffset > 60 && onStatusChange) {
            triggerVibration([50, 100, 50]);

            setSwipeOffset(window.innerWidth);
            setTimeout(() => {
                handleAction();
            }, 200);
        } else {
            setSwipeOffset(0);
        }

        setTouchStartX(null);
        setTouchStartY(null);
        setIsDragging(false);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (swipeOffset > 0 || isDragging) {
            e.preventDefault();
        }
    };

    // ==========================================
    // RENDU 1 : MODE LISTE (Intégré)
    // ==========================================
    if (layout === 'list') {
        const content = (
            <div className="relative w-full bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden flex group transition-all hover:border-zinc-700 h-full">
                <div className="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 bg-zinc-950 relative">
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                </div>

                <div className="p-3 flex flex-col justify-between flex-grow min-w-0 pr-14 gap-1">
                    <div className="flex flex-col justify-start flex-grow min-w-0 pr-14 gap-1">
                        <h3 className="text-white text-xl">{title}</h3>
                        {mediaType === 'tv' && nextEpisode > 0 && (
                            <div className="flex flex-col">
                                <h3 className="font-medium text-m text-purple-400">
                                    S{nextSeason} | E{nextEpisode}
                                </h3>
                            </div>
                        )}

                        {year && !nextEpisode && <p className="text-xs text-zinc-500">{year}</p>}
                    </div>

                    {!isPerson && item.vote_average > 0 && (
                        <div className="text-amber-400 text-sm font-bold flex items-center gap-1">
                            <Star fill="currentColor" size={12} /> {item.vote_average.toFixed(1)}
                        </div>
                    )}
                </div>

                {onStatusChange && !isPerson && item.status_local !== 'watched' && (
                    <div className="absolute right-3 top-0 bottom-0 flex items-center z-20">
                        <button
                            disabled={isProcessing}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isProcessing) return;

                                triggerVibration([20, 80, 20]);
                                setSwipeOffset(window.innerWidth);
                                setTimeout(() => {
                                    handleAction();
                                }, 200);
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-500 rounded-full transition-all border border-zinc-700/50 backdrop-blur-sm disabled:opacity-50"
                        >
                            <CheckCircle size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                )}
            </div>
        );

        return (
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }}
                className="relative overflow-hidden rounded-xl cursor-pointer select-none"
            >
                <div className="absolute inset-0 bg-emerald-500/90 flex items-center px-6 z-0">
                    {isProcessing ? (
                        <Loader className="text-white animate-spin" size={32} />
                    ) : (
                        <CheckCircle className="text-white" size={32} />
                    )}
                </div>

                <div
                    className="relative z-10 w-full"
                    style={{
                        transform: `translateX(${swipeOffset}px)`,
                        transition: swipeOffset > 0 && !isDragging ? 'transform 0.3s ease-out' : 'none'
                    }}
                >
                    <Link to={targetUrl} onClick={handleClick} className="block">
                        {content}
                    </Link>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDU 2 : MODE CARTE
    // ==========================================
    const cardClasses = "bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex flex-col group transition-all hover:border-zinc-700 relative";

    const content = (
        <div className="flex flex-col flex-grow cursor-pointer relative">
            <div className="aspect-[2/3] w-full overflow-hidden relative bg-zinc-950">
                <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />

                {!isPerson && item.vote_average > 0 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-zinc-950/80 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[10px] backdrop-blur-sm border border-zinc-800">
                        <Star fill="currentColor" size={10} /> {item.vote_average.toFixed(1)}
                    </div>
                )}

                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {item.is_favorite && (
                        <div className="bg-black/90 text-red-500 p-1.5 rounded-full shadow-md backdrop-blur-sm">
                            <Heart fill="currentColor" size={10} />
                        </div>
                    )}
                    {daysLeft !== null && (
                        <div className="flex items-center gap-1 bg-purple-500 text-black px-2 py-1 rounded-md text-[13px] font-black shadow-lg shadow-purple-500/20">
                            <CalendarClock size={14} />
                            <span>J-{daysLeft}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-2.5 pb-1 flex flex-col justify-between flex-grow gap-1">
                <h3 className="font-medium text-xs text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                {item.episodes && (
                    <div className="text-[10px] text-zinc-400 font-medium line-clamp-1">
                        S{item.seasons[0]}E{item.episodes.join(', ')}
                    </div>
                )}
                {year && <p className="text-[10px] text-zinc-500 font-medium">{year}</p>}
            </div>
        </div>
    );

    return (
        <div className={cardClasses}>
            {isPerson ? <div>{content}</div> : <Link to={targetUrl}>{content}</Link>}

            {fallbackMediaType === 'movie' && onStatusChange && !isPerson && item.status_local && (
                <div className="p-2 pt-1.5 z-10 relative">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            triggerVibration(item.status_local === 'watchlist' ? [50, 80, 20] : [20, 80, 20]);
                            onStatusChange(item.id || item.tmdb_id, item.status_local === 'watchlist' ? 'watched' : 'watchlist')
                        }}
                        className={`w-full py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 ${item.status_local === 'watchlist'
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                    >
                        {item.status_local === 'watchlist' && (
                            <><Eye size={12} strokeWidth={2.5} /> MARQUER VU</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};