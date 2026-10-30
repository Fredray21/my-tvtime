import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle, Film, Heart, Star } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { triggerVibration } from '../../utils/haptics';
import type { SagaPart, SagaResponse } from '../../api/mediaApi';
import { MEDIA_MUTATION_KEY, type MediaMutationVars } from '../../offline/mutations';
import { OfflineNotice } from '../../offline/OfflineNotice';

export const SagaDetailsView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const api = useApi();
    const queryClient = useQueryClient();
    const sagaId = Number(id);

    const { data: saga, isLoading, isError, fetchStatus } = useQuery({
        queryKey: ['saga', sagaId],
        queryFn: () => api.media.getSaga(sagaId),
        enabled: !isNaN(sagaId),
    });

    // Marquer un film vu : affichage immédiat (progression recalculée), mis en file d'attente si hors ligne
    const watchMutation = useMutation<unknown, Error, MediaMutationVars>({
        mutationKey: MEDIA_MUTATION_KEY,
        onMutate: async (vars) => {
            if (vars.kind !== 'status') return;
            await queryClient.cancelQueries({ queryKey: ['saga', sagaId] });
            queryClient.setQueryData<SagaResponse>(['saga', sagaId], old => {
                if (!old) return old;
                const parts = old.parts.map(part => part.id === vars.dto.tmdb_id ? { ...part, status_local: 'watched' as const } : part);
                const released = parts.filter(part => part.is_released);
                const watchedCount = released.filter(part => part.status_local === 'watched').length;
                return {
                    ...old,
                    parts,
                    watched_count: watchedCount,
                    is_complete: released.length > 0 && watchedCount === released.length,
                    next_movie: released.find(part => part.status_local !== 'watched') ?? null,
                };
            });
        },
    });

    const markWatched = (movieId: number) => watchMutation.mutate({
        kind: 'status',
        dto: { tmdb_id: movieId, media_type: 'movie', status_local: 'watched', is_favorite: false, rewatch_count: 0 },
    });

    if (isLoading && fetchStatus === 'paused') return <OfflineNotice what="Cette saga" />;
    if (isLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">Chargement de la saga...</div>;
    if (isError || !saga) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    const percent = saga.released_count > 0 ? Math.round((saga.watched_count / saga.released_count) * 100) : 0;
    let releasedIndex = 0;

    const renderPart = (part: SagaPart) => {
        const isWatched = part.status_local === 'watched';
        const isNext = saga.next_movie?.id === part.id;
        const number = part.is_released ? ++releasedIndex : null;
        const year = part.release_date ? new Date(part.release_date).getFullYear() : null;

        return (
            <div
                key={part.id}
                className={`flex items-center gap-3 bg-zinc-900/60 border rounded-xl p-2 pr-3 transition-all ${isNext
                    ? 'border-purple-500/50 bg-purple-500/5'
                    : isWatched
                        ? 'border-emerald-500/20'
                        : 'border-zinc-800/40'} ${part.is_released ? '' : 'opacity-60'}`}
            >
                <span className={`w-6 text-center text-lg font-black flex-shrink-0 ${isWatched ? 'text-emerald-500' : 'text-zinc-600'}`}>
                    {number ?? '·'}
                </span>

                <Link to={`/movie/${part.id}`} className="flex items-center gap-3 flex-grow min-w-0">
                    <div className="w-12 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-zinc-950 relative">
                        {part.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w154${part.poster_path}`} alt={part.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700"><Film size={16} /></div>
                        )}
                        {part.is_favorite && (
                            <div className="absolute top-1 right-1 bg-black/90 text-red-500 p-0.5 rounded-full"><Heart fill="currentColor" size={8} /></div>
                        )}
                    </div>
                    <div className="min-w-0">
                        {isNext && <p className="text-[9px] font-black uppercase tracking-wider text-purple-400">Prochain à voir</p>}
                        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">{part.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-zinc-500">
                            <span>{year ?? 'Date inconnue'}</span>
                            {!!part.vote_average && part.vote_average > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-400"><Star fill="currentColor" size={9} /> {part.vote_average.toFixed(1)}</span>
                            )}
                        </div>
                    </div>
                </Link>

                {isWatched ? (
                    <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold border bg-emerald-500/20 text-emerald-400 border-emerald-500/20">Vu</span>
                ) : part.is_released ? (
                    <button
                        onClick={() => {
                            triggerVibration([20, 80, 20]);
                            markWatched(part.id);
                        }}
                        title="Marquer comme vu"
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-zinc-800/80 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-500 rounded-full transition-all border border-zinc-700/50 disabled:opacity-50"
                    >
                        <CheckCircle size={20} strokeWidth={2.5} />
                    </button>
                ) : (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300">
                        <CalendarClock size={11} /> À venir
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            <div className="relative w-full aspect-video sm:aspect-[21/9] bg-zinc-900">
                {saga.backdrop_path && (
                    <img src={`https://image.tmdb.org/t/p/w1280${saga.backdrop_path}`} alt={saga.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>

                <button
                    onClick={() => {
                        triggerVibration()
                        navigate(-1)
                    }}
                    className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition aspect-square"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </div>

            <div className="px-4 -mt-10 sm:-mt-16 relative z-10 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 leading-tight">{saga.name}</h1>
                <p className="text-xs font-medium text-zinc-400 mb-6">
                    {saga.released_count} films{saga.upcoming_count > 0 && ` · ${saga.upcoming_count} à venir`}
                </p>

                {/* PROGRESSION */}
                <div className="mb-8 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex items-baseline justify-between mb-3">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Ta progression</h2>
                        <span className={`text-2xl font-black ${saga.is_complete ? 'text-emerald-400' : 'text-white'}`}>
                            {saga.watched_count}/{saga.released_count}
                        </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${saga.is_complete ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <p className="text-xs text-zinc-400 mt-3">
                        {saga.is_complete
                            ? 'Saga terminée, bravo ✓'
                            : saga.next_movie
                                ? <>Prochain : <span className="text-white font-semibold">{saga.next_movie.title}</span></>
                                : 'Pas encore commencée.'}
                    </p>
                </div>

                {saga.overview && (
                    <div className="mb-8">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-2">La saga</h2>
                        <p className="text-zinc-300 text-sm leading-relaxed opacity-90">{saga.overview}</p>
                    </div>
                )}

                <div className="mb-12">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-1">Les films</h2>
                    <p className="text-zinc-500 text-xs mb-4">Dans l'ordre de sortie.</p>
                    <div className="flex flex-col gap-2">{saga.parts.map(renderPart)}</div>
                </div>
            </div>
        </div>
    );
};
