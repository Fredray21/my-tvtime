import React from 'react';
import { Link } from 'react-router-dom';
import { type MediaCustomResponse } from '../api/mediaApi';

interface MovieCardProps {
    movie: MediaCustomResponse;
    onStatusChange?: (movieId: number, newStatus: 'watchlist' | 'watched') => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onStatusChange }) => {
    // TMDB donne juste le chemin partiel, on reconstruit l'URL de l'image
    const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://dummyimage.com/500x750?text=No+Poster';

    return (
        <div className="relative flex flex-col bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-800/50 group">
            <Link to={`/movie/${movie.id}`} className="flex flex-col flex-grow cursor-pointer">
                {/* Container de l'image avec ratio cinéma (2/3) */}
                <div className="aspect-[2/3] w-full overflow-hidden relative">
                    <img
                        src={posterUrl}
                        alt={movie.title || movie.name || 'Titre inconnu'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />

                    {/* Badge de favori discret en haut à droite */}
                    {movie.is_favorite && (
                        <div className="absolute top-2 right-2 bg-red-500/90 text-white p-1.5 rounded-full text-xs shadow-md backdrop-blur-sm">
                            ❤️
                        </div>
                    )}
                </div>

                {/* Titre du film */}
                <div className="p-3 pb-0 flex flex-col flex-grow gap-1">
                    <h3 className="font-medium text-sm text-zinc-200 line-clamp-1 group-hover:text-white transition-colors">
                        {movie.title}
                    </h3>
                </div>
            </Link>

            {/* Infos du film en dessous */}
            <div className="p-3 flex flex-col flex-grow justify-between gap-2">
                {/* Bouton d'action rapide style Keekup */}
                <button
                    onClick={() => onStatusChange?.(movie.id, movie.status_local === 'watchlist' ? 'watched' : 'watchlist')}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${movie.status_local === 'watchlist'
                        ? 'bg-purple-500 hover:bg-purple-600 text-zinc-950'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                >
                    {movie.status_local === 'watchlist' ? '⏳ À voir' : '✅ Vu'}
                </button>
            </div>
        </div>
    );
};