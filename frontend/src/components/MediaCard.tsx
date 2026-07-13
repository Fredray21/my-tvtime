import React from 'react';
import { Link } from 'react-router-dom';

interface MediaCardProps {
    item: any;
    fallbackMediaType?: 'movie' | 'tv';
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
    const targetUrl = `/${mediaType}/${item.id}`;


    // ==========================================
    // RENDU 1 : MODE LISTE (Pour la recherche)
    // ==========================================
    if (layout === 'list') {
        const listClasses = "w-full bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex group transition-all hover:border-zinc-700 cursor-pointer";

        const content = (
            <>
                <div className="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 bg-zinc-950 relative">
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-3 flex flex-col justify-center flex-grow">
                    <h3 className="font-medium text-sm sm:text-base text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                    {year && <p className="text-xs text-zinc-500 mt-1">{year}</p>}
                    {!isPerson && item.vote_average > 0 && (
                        <div className="mt-2 text-amber-400 text-xs font-bold">⭐️ {item.vote_average.toFixed(1)}</div>
                    )}
                    {item.is_favorite && (
                        <div className="mt-1 text-emerald-400 text-xs font-bold">❤️ Favori</div>
                    )}
                </div>
            </>
        );

        return isPerson ? <div className={listClasses}>{content}</div> : <Link to={targetUrl} className={listClasses}>{content}</Link>;
    }

    // ==========================================
    // RENDU 2 : MODE CARTE (Recherche & Watchlist)
    // ==========================================
    const cardClasses = "bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex flex-col group transition-all hover:border-zinc-700 relative";

    const content = (
        <div className="flex flex-col flex-grow cursor-pointer">
            <div className="aspect-[2/3] w-full overflow-hidden relative bg-zinc-950">
                <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />

                {!isPerson && item.vote_average > 0 && (
                    <div className="absolute top-2 left-2 bg-zinc-950/80 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[10px] backdrop-blur-sm border border-zinc-800">
                        ⭐️ {item.vote_average.toFixed(1)}
                    </div>
                )}

                {item.is_favorite && (
                    <div className="absolute top-2 right-2 bg-black/90 text-white p-1 rounded-full text-[10px] shadow-md backdrop-blur-sm">
                        ❤️
                    </div>
                )}
            </div>

            <div className="p-2.5 pb-1 flex flex-col justify-between flex-grow gap-1">
                <h3 className="font-medium text-xs text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                {year && <p className="text-[10px] text-zinc-500 font-medium">{year}</p>}
            </div>
        </div>
    );

    return (
        <div className={cardClasses}>
            {isPerson ? <div>{content}</div> : <Link to={targetUrl}>{content}</Link>}

            {/* LE BOUTON : Apparaît uniquement si onStatusChange est fourni ET qu'il y a un status */}
            {onStatusChange && !isPerson && item.status_local && (
                <div className="p-2 pt-1.5 z-10 relative">
                    <button
                        onClick={() => onStatusChange(item.id, item.status_local === 'watchlist' ? 'watched' : 'watchlist')}
                        className={`w-full py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all duration-200 ${item.status_local === 'watchlist'
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                    >
                        {item.status_local === 'watchlist' ? '👁️ MARQUER VU' : '✅ DÉJÀ VU'}
                    </button>
                </div>
            )}
        </div>
    );
};