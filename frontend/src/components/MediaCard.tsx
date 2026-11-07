import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, CheckCircle, Check, CalendarClock, Loader, Bookmark, Play } from 'lucide-react';
import { triggerVibration } from '../utils/haptics';
import { providerLogoUrl, useMyPlatforms } from '../hooks/useMyPlatforms';
import type { WatchProvider } from '../api/mediaApi';

// Ce qu'une carte sait afficher : films / séries (watchlist, recherche, favoris...) et personnes (recherche)
export interface MediaCardItem {
    id?: number;
    tmdb_id?: number;
    title?: string;
    name?: string;
    poster_path?: string | null;
    profile_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    media_type?: 'movie' | 'tv' | 'person';
    vote_average?: number;
    is_favorite?: boolean;
    status_local?: string;
    next_season_number?: number;
    next_episode_number?: number;
    next_episode_to_air?: { air_date?: string } | null;
    // Plateformes incluses en France (absent dans les listes TMDB)
    available_on?: WatchProvider[];
}

interface MediaCardProps {
    item: MediaCardItem;
    fallbackMediaType?: 'movie' | 'tv' | 'person';
    layout?: 'card' | 'list';
    onStatusChange?: (mediaId: number, newStatus: 'watchlist' | 'watched') => Promise<void> | void;
    onWatchEpisode?: (id: number, season: number, episode: number) => Promise<void> | void;
    // Affiche une pastille "Vu / En cours / Dans ta liste" (utile hors de la watchlist)
    showStatusBadge?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
    item,
    fallbackMediaType = 'movie',
    layout = 'card',
    onStatusChange,
    onWatchEpisode,
    showStatusBadge = false
}) => {
    const title = item.title || item.name || 'Sans titre';
    const imagePath = item.poster_path || item.profile_path;
    const imageUrl = imagePath
        ? `https://image.tmdb.org/t/p/w500${imagePath}`
        : 'https://dummyimage.com/500x750?text=No+Poster';

    const rawDate = item.release_date || item.first_air_date;
    const year = rawDate ? new Date(rawDate).getFullYear() : null;

    const itemId = item.id ?? item.tmdb_id ?? 0;
    const mediaType = item.media_type || fallbackMediaType;
    const isPerson = mediaType === 'person';
    const targetUrl = `/${mediaType}/${itemId}`;

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
    const [justDone, setJustDone] = useState(false);

    // Logos de mes plateformes qui incluent ce titre (2 max pour rester lisible)
    const { myProvidersFor } = useMyPlatforms();
    const myProviders = isPerson ? [] : myProvidersFor(item.available_on).slice(0, 2);
    const platformLogos = myProviders.length > 0 && (
        <span className="flex -space-x-1" title={`Inclus : ${myProviders.map(p => p.provider_name).join(', ')}`}>
            {myProviders.map(p => (
                <img key={p.provider_id} src={providerLogoUrl(p.logo_path)} alt={p.provider_name} className="w-[18px] h-[18px] rounded-[5px] ring-1 ring-black/60 object-cover" loading="lazy" />
            ))}
        </span>
    );

    const nextSeason = item.next_season_number ?? 0;
    const nextEpisode = item.next_episode_number ?? 0;

    const handleAction = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            if (mediaType === 'tv' && nextEpisode > 0 && onWatchEpisode) {
                await onWatchEpisode(itemId, nextSeason, nextEpisode);
            } else if (onStatusChange) {
                await onStatusChange(itemId, 'watched');
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
                        <h3 className="text-white text-xl line-clamp-1">{title}</h3>

                        {mediaType === 'tv' && nextEpisode > 0 && (
                            <div className="flex flex-col">
                                <h3 className="font-medium text-sm text-purple-400">
                                    S{nextSeason} | E{nextEpisode}
                                </h3>
                            </div>
                        )}

                        {/* Conteneur pour l'année ET le badge J-XXX */}
                        <div className="flex items-center gap-2 mt-0.5">
                            {year && !nextEpisode && <p className="text-xs text-zinc-500">{year}</p>}
                            {platformLogos}

                            {/* AJOUT DU TAG J-XXX ICI */}
                            {daysLeft !== null && (
                                <div className="flex items-center gap-1 bg-purple-500 text-black px-1.5 py-0.5 rounded text-[11px] font-black shadow-sm w-fit">
                                    <CalendarClock size={12} />
                                    <span>J-{daysLeft}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isPerson && !!item.vote_average && item.vote_average > 0 && (
                        <div className="text-amber-400 text-sm font-bold flex items-center gap-1 mt-1">
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
                // isolate : les z-index internes (fond du swipe) restent dans la carte et ne passent pas devant les en-têtes collants
                className="relative isolate overflow-hidden rounded-xl cursor-pointer select-none"
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
    // Action rapide sur l'affiche : film à voir -> vu, série -> prochain épisode vu
    const canMarkMovie = mediaType === 'movie' && !!onStatusChange && item.status_local === 'watchlist';
    const canMarkEpisode = mediaType === 'tv' && !!onWatchEpisode && nextEpisode > 0;
    const hasQuickAction = !isPerson && (canMarkMovie || canMarkEpisode);

    const statusBadge = showStatusBadge && !isPerson ? getStatusBadge(item.status_local) : null;
    const rating = !isPerson && item.vote_average && item.vote_average > 0 ? item.vote_average.toFixed(1) : null;

    const handleQuickAction = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isProcessing || justDone) return;
        triggerVibration([20, 60, 20]);
        setJustDone(true);
        // Petite pause pour laisser l'animation de validation se jouer avant que la carte ne bouge
        await new Promise(resolve => setTimeout(resolve, 350));
        await handleAction();
        setJustDone(false);
    };

    return (
        <Link to={targetUrl} className="group flex flex-col gap-2 min-w-0 outline-none">
            <div className={`relative w-full overflow-hidden ${isPerson ? 'aspect-square rounded-full' : 'aspect-[2/3] rounded-xl'} bg-zinc-900 ring-1 ring-white/5 shadow-lg shadow-black/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:ring-white/15 group-focus-visible:ring-2 group-focus-visible:ring-purple-500`}>
                <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                />

                {/* Dégradé discret pour la lisibilité des pastilles */}
                {(hasQuickAction || daysLeft !== null || platformLogos) && (
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                )}

                {/* Haut : sortie prochaine / statut, favori */}
                <div className="absolute top-1.5 inset-x-1.5 flex items-start justify-between gap-1 pointer-events-none">
                    {daysLeft !== null ? (
                        <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-purple-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-purple-400/30">
                            <CalendarClock size={10} /> J-{daysLeft}
                        </span>
                    ) : statusBadge ? (
                        <span className={`flex items-center justify-center w-5 h-5 rounded-full backdrop-blur-md ${statusBadge.className}`} title={statusBadge.label}>
                            <statusBadge.icon size={11} strokeWidth={3} />
                        </span>
                    ) : <span />}
                    {item.is_favorite && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black/60 backdrop-blur-md text-rose-500">
                            <Heart fill="currentColor" size={10} />
                        </span>
                    )}
                </div>

                {/* Bas : mes plateformes, prochain épisode + action rapide */}
                {(hasQuickAction || platformLogos) && (
                    <div className="absolute bottom-1.5 inset-x-1.5 flex items-end justify-between gap-1 pointer-events-none">
                        <span className="flex flex-col items-start gap-1">
                            {platformLogos}
                            {canMarkEpisode && (
                                <span className="bg-black/60 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums">
                                    S{nextSeason} · E{nextEpisode}
                                </span>
                            )}
                        </span>
                        {hasQuickAction && <button
                            type="button"
                            onClick={handleQuickAction}
                            disabled={isProcessing}
                            aria-label={canMarkEpisode ? `Marquer S${nextSeason}E${nextEpisode} comme vu` : 'Marquer comme vu'}
                            className={`pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-md transition-all duration-300 active:scale-90 ${justDone
                                ? 'bg-emerald-500 text-black scale-110 shadow-lg shadow-emerald-500/40'
                                : 'bg-black/55 text-white/90 ring-1 ring-white/20 hover:bg-emerald-500 hover:text-black hover:ring-emerald-400'
                                }`}
                        >
                            {isProcessing && !justDone
                                ? <Loader size={14} className="animate-spin" />
                                : <Check size={16} strokeWidth={3} />}
                        </button>}
                    </div>
                )}
            </div>

            <div className={`min-w-0 px-0.5 ${isPerson ? 'text-center' : ''}`}>
                <h3 className="text-[12px] font-semibold leading-tight text-zinc-200 line-clamp-1 group-hover:text-white transition-colors">{title}</h3>
                {!isPerson && (year || rating) && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 tabular-nums">
                        {year && <span>{year}</span>}
                        {year && rating && <span className="w-0.5 h-0.5 rounded-full bg-zinc-600" />}
                        {rating && (
                            <span className="flex items-center gap-0.5 text-zinc-400">
                                <Star size={9} fill="currentColor" className="text-amber-400" /> {rating}
                            </span>
                        )}
                    </p>
                )}
            </div>
        </Link>
    );
};

// Pastille de statut pour les listes de découverte (recherche, tendances)
const getStatusBadge = (status?: string): { icon: React.ElementType; label: string; className: string } | null => {
    switch (status) {
        case 'watched':
        case 'finished':
            return { icon: Check, label: 'Vu', className: 'bg-emerald-500/90 text-black' };
        case 'watching':
        case 'pending':
            return { icon: Play, label: 'En cours', className: 'bg-purple-500/90 text-black' };
        case 'watchlist':
            return { icon: Bookmark, label: 'Dans ta liste', className: 'bg-black/60 text-white ring-1 ring-white/20' };
        default:
            return null;
    }
};