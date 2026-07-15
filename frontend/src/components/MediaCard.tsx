import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, Check, Eye, CalendarClock } from 'lucide-react';
import { triggerVibration } from '../utils/haptics';

interface MediaCardProps {
    item: any;
    fallbackMediaType?: 'movie' | 'tv' | 'person';
    layout?: 'card' | 'list';
    onStatusChange?: (mediaId: number, newStatus: 'watchlist' | 'watched') => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
    item,
    fallbackMediaType = 'movie',
    layout = 'card',
    onStatusChange
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

    // 🟢 CALCUL DU COMPTE À REBOURS (J-X)
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

    // 🟢 LOGIQUE DU SWIPE (Uniquement en mode Liste)
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (layout !== 'list' || !onStatusChange || isPerson || item.status_local === 'watched') return;
        setTouchStartX(e.touches[0].clientX);
        setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartX || !touchStartY || layout !== 'list') return;
        const xDiff = e.touches[0].clientX - touchStartX;
        const yDiff = e.touches[0].clientY - touchStartY;

        // Bloque le swipe vertical (pour pouvoir scroller la page normalement)
        if (Math.abs(xDiff) > Math.abs(yDiff) && xDiff > 0) {
            setSwipeOffset(Math.min(xDiff, 80)); // Limite le déplacement à 80px
        }
    };

    const handleTouchEnd = () => {
        if (swipeOffset > 60 && onStatusChange) {
            triggerVibration([50, 100, 50]);
            onStatusChange(item.id || item.tmdb_id, 'watched');
        }
        setSwipeOffset(0);
        setTouchStartX(null);
        setTouchStartY(null);
    };

    // Empêche le clic accidentel (navigation) quand on relâche le swipe
    const handleClick = (e: React.MouseEvent) => {
        if (swipeOffset > 0) {
            e.preventDefault();
        }
    };

    // ==========================================
    // RENDU 1 : MODE LISTE
    // ==========================================
    if (layout === 'list') {
        const content = (
            <div
                style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.3s ease' : 'none' }}
                className="relative w-full bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex group transition-all hover:border-zinc-700 h-full"
            >
                <div className="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 bg-zinc-950 relative">
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-3 flex flex-col justify-center flex-grow min-w-0">
                    <h3 className="font-medium text-sm sm:text-base text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                    {item.episodes && (
                        <div className="text-xs text-zinc-500 mt-1">
                            S{item.seasons[0]}E{item.episodes.join(', ')}
                        </div>
                    )}
                    {year && <p className="text-xs text-zinc-500 mt-1">{year}</p>}

                    {!isPerson && item.vote_average > 0 && (
                        <div className="mt-2 text-amber-400 text-xs font-bold flex items-center gap-1">
                            <Star fill="currentColor" size={12} /> {item.vote_average.toFixed(1)}
                        </div>
                    )}
                    {item.is_favorite && (
                        <div className="mt-1 text-red-500 text-xs font-bold flex items-center gap-1">
                            <Heart fill="currentColor" size={12} /> Favori
                        </div>
                    )}
                </div>

                <div className="ml-auto flex flex-col justify-center items-end gap-2 pr-3 shrink-0">
                    {daysLeft !== null && (
                        <div className="flex items-center gap-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold px-3 py-1.5 rounded-lg">
                            <CalendarClock size={14} />
                            <span className="text-sm">J-{daysLeft}</span>
                        </div>
                    )}

                    {onStatusChange && !isPerson && item.status_local !== 'watched' && (
                        <button
                            onClick={(e) => {
                                e.preventDefault(); // Empêche d'ouvrir la page détail
                                e.stopPropagation();
                                triggerVibration([20, 80, 20]);
                                onStatusChange(item.id || item.tmdb_id, 'watched');
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-500 rounded-full transition-all border border-zinc-700 hover:border-emerald-500/50"
                        >
                            <Check size={18} strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>
        );

        return (
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative overflow-hidden rounded-xl cursor-pointer"
            >
                {/* 🟢 FOND VERT (RÉVÉLÉ PENDANT LE SWIPE) */}
                {swipeOffset > 0 && (
                    <div className="absolute inset-0 bg-emerald-500 flex items-center px-6 rounded-xl">
                        <span className="text-white font-bold flex items-center gap-2">
                            <Check size={20} strokeWidth={3} /> Marquer vu
                        </span>
                    </div>
                )}
                {isPerson ? <div>{content}</div> : <Link to={targetUrl} onClick={handleClick} className="block">{content}</Link>}
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

                {/* 🟢 NOTE (En haut à gauche) */}
                {!isPerson && item.vote_average > 0 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-zinc-950/80 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[10px] backdrop-blur-sm border border-zinc-800">
                        <Star fill="currentColor" size={10} /> {item.vote_average.toFixed(1)}
                    </div>
                )}

                {/* 🟢 FAVORIS ET J-X (En haut à droite) */}
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
                            e.preventDefault(); // Empêche d'ouvrir la page détail
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