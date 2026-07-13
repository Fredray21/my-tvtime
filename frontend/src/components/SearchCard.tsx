import React from 'react';
import { Link } from 'react-router-dom';
import { type SearchResultBase } from '../api/searchApi';

interface SearchCardProps {
    item: SearchResultBase;
    layout?: 'card' | 'list';
}

export const SearchCard: React.FC<SearchCardProps> = ({ item, layout = 'card' }) => {
    const title = item.title || item.name || 'Sans titre';
    const imagePath = item.poster_path || item.profile_path;
    const imageUrl = imagePath
        ? `https://image.tmdb.org/t/p/w500${imagePath}`
        : 'https://dummyimage.com/500x750?text=No+Image';

    // Formatage de la date (Film ou Série)
    const rawDate = item.release_date || item.first_air_date;
    const year = rawDate ? new Date(rawDate).getFullYear() : null;

    const isMovie = item.media_type === 'movie';
    const targetUrl = `/movie/${item.id}`;

    const listClasses = "w-full bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex group transition-all hover:border-zinc-700 cursor-pointer";
    const cardClasses = "bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden flex flex-col group transition-all hover:border-zinc-700 cursor-pointer";

    // Inner Render pour le Mode Liste
    const renderListContent = () => (
        <>
            <div className="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 bg-zinc-950 relative">
                <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-3 flex flex-col justify-center flex-grow">
                <h3 className="font-medium text-sm sm:text-base text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                {year && <p className="text-xs text-zinc-500 mt-1">{year}</p>}
                {item.media_type !== 'person' && item.vote_average !== undefined && item.vote_average > 0 && (
                    <div className="mt-2 text-amber-400 text-xs font-bold">⭐️ {item.vote_average.toFixed(1)}</div>
                )}
            </div>
        </>
    );

    // Inner Render pour le Mode Carte
    const renderCardContent = () => (
        <>
            <div className="aspect-[2/3] w-full overflow-hidden relative bg-zinc-950">
                <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                {item.media_type !== 'person' && item.vote_average !== undefined && item.vote_average > 0 && (
                    <div className="absolute top-2 left-2 bg-zinc-950/80 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[10px] backdrop-blur-sm border border-zinc-800">
                        ⭐️ {item.vote_average.toFixed(1)}
                    </div>
                )}
            </div>
            <div className="p-2.5 flex flex-col justify-between flex-grow gap-1">
                <h3 className="font-medium text-xs text-zinc-200 line-clamp-1 group-hover:text-white">{title}</h3>
                {year && <p className="text-[10px] text-zinc-500 font-medium">{year}</p>}
            </div>
        </>
    );


    if (layout === 'list') {
        return isMovie
            ? <Link to={targetUrl} className={listClasses}>{renderListContent()}</Link>
            : <div className={listClasses}>{renderListContent()}</div>;
    }

    return isMovie
        ? <Link to={targetUrl} className={cardClasses}>{renderCardContent()}</Link>
        : <div className={cardClasses}>{renderCardContent()}</div>;
};