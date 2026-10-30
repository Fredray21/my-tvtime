import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Layers } from 'lucide-react';
import { useApi } from '../context/ApiContext';

interface SagaProgressProps {
    collectionId: number;
    currentMovieId: number;
}

// Encart "Fait partie de la saga..." affiché sur la fiche d'un film
export const SagaProgress: React.FC<SagaProgressProps> = ({ collectionId, currentMovieId }) => {
    const api = useApi();

    const { data: saga, isLoading } = useQuery({
        queryKey: ['saga', collectionId],
        queryFn: () => api.media.getSaga(collectionId),
    });

    if (isLoading) return <div className="h-28 mb-8 bg-zinc-900 rounded-xl animate-pulse" />;
    if (!saga || saga.parts.length < 2) return null;

    const percent = saga.released_count > 0 ? Math.round((saga.watched_count / saga.released_count) * 100) : 0;
    const next = saga.next_movie && saga.next_movie.id !== currentMovieId ? saga.next_movie : null;

    return (
        <Link
            to={`/saga/${saga.id}`}
            className="block mb-8 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-all"
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <Layers size={12} /> Fait partie de la saga
                    </p>
                    <h2 className="text-sm font-bold text-zinc-100 line-clamp-1 mt-0.5">{saga.name}</h2>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-sm font-black ${saga.is_complete ? 'text-emerald-400' : 'text-white'}`}>
                        {saga.watched_count}/{saga.released_count}
                    </span>
                    <ChevronRight size={16} className="text-zinc-500" />
                </div>
            </div>

            {/* Mini affiches dans l'ordre de sortie */}
            <div className="flex gap-1.5 overflow-hidden mb-3">
                {saga.parts.map(part => (
                    <div
                        key={part.id}
                        className={`relative w-9 flex-shrink-0 aspect-[2/3] rounded overflow-hidden bg-zinc-950 ${part.id === currentMovieId ? 'ring-2 ring-purple-500' : ''} ${part.is_released ? '' : 'opacity-40'}`}
                    >
                        {part.poster_path && (
                            <img src={`https://image.tmdb.org/t/p/w92${part.poster_path}`} alt={part.title} className="w-full h-full object-cover" loading="lazy" />
                        )}
                        {part.status_local === 'watched' && (
                            <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                                <Check size={14} strokeWidth={3} className="text-white" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${saga.is_complete ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${percent}%` }} />
            </div>

            <p className="text-xs text-zinc-400 mt-2">
                {saga.is_complete
                    ? 'Saga terminée ✓'
                    : next
                        ? <>Prochain à voir : <span className="text-white font-semibold">{next.title}</span></>
                        : `${saga.released_count - saga.watched_count} film(s) restant(s)`}
                {saga.upcoming_count > 0 && <span className="text-zinc-500"> · {saga.upcoming_count} à venir</span>}
            </p>
        </Link>
    );
};
