import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { triggerVibration } from '../../utils/haptics';
import type { UpdateStatusDTO } from '../../api/mediaApi';
import { MediaTrailers } from '../../components/MediaTrailers';

export const MovieDetailsView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const api = useApi();
    const queryClient = useQueryClient();

    const movieId = Number(id);
    const mediaType = 'movie';

    // 1. Récupération des données du film
    const { data: movie, isLoading, isError } = useQuery({
        queryKey: ['movie', mediaType, movieId],
        queryFn: () => api.media.getMediaDetails(movieId, mediaType),
        enabled: !isNaN(movieId),
    });

    // Récupération de la distribution (casting)
    const { data: credits, isLoading: isCreditsLoading } = useQuery({
        queryKey: ['movie', 'credits', movieId],
        queryFn: () => api.media.getMediaCredits(movieId, mediaType),
        enabled: !isNaN(movieId),
        staleTime: Infinity, // Le casting ne change pas, on garde indéfiniment en cache
    });

    const { data: similarMovies, isLoading: isSimilarLoading } = useQuery({
        queryKey: ['movie', 'similar', movieId],
        queryFn: () => api.media.getSimilar(movieId, mediaType),
        enabled: !isNaN(movieId),
    });

    // 2. Mutation pour modifier le statut (Optimistic UI)
    const mutation = useMutation({
        mutationFn: async (variables: { newStatus: UpdateStatusDTO['status_local']; isFavorite: boolean; rewatch_count: number }) => {
            if (variables.newStatus === 'not_tracked') {
                return api.media.removeMedia(movieId, mediaType);
            }

            // Sinon, on met à jour son statut
            return api.media.updateStatus({
                tmdb_id: movieId,
                media_type: mediaType,
                status_local: variables.newStatus,
                is_favorite: variables.newStatus === 'watched' ? variables.isFavorite : false, // On ne peut pas être favori si on n'a pas vu le film
                rewatch_count: variables.rewatch_count || 0
            });
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['movie', mediaType, movieId] });
            const previousMovie = queryClient.getQueryData(['movie', mediaType, movieId]);

            queryClient.setQueryData(['movie', mediaType, movieId], (old: any) => {
                if (!old) return old;

                const isFirstWatch = old.status_local !== 'watched' && variables.newStatus === 'watched';

                const now = new Date().toISOString();

                return {
                    ...old,
                    status_local: variables.newStatus,
                    is_favorite: variables.isFavorite,
                    created_at: isFirstWatch ? now : old.created_at,
                    updated_at: now,
                };
            });
            return { previousMovie };
        },
        onError: (err, _, context) => {
            if (context?.previousMovie) {
                queryClient.setQueryData(['movie', mediaType, movieId], context.previousMovie);
            }
            console.error("Erreur de mutation :", err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['movie', mediaType, movieId] });
            queryClient.invalidateQueries({ queryKey: ['watchlist'] });
        },
    });

    if (isLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">Chargement de la fiche...</div>;
    if (isError || !movie) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    // Formatages visuels
    const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
    const year = movie.release_date ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(movie.release_date)) : 'N/A';

    const safeRuntime = movie.runtime || 0;
    const runtimeHours = Math.floor(safeRuntime / 60);
    const runtimeMinutes = safeRuntime % 60;
    const formattedRuntime = safeRuntime > 0 ? `${runtimeHours}h ${runtimeMinutes.toString().padStart(2, '0')}m` : '';

    const formatCurrency = (amount?: number) => {
        if (!amount || amount === 0) return 'Inconnu';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* HEADER: Image de fond + Bouton retour */}
            <div className="relative w-full aspect-video sm:aspect-[21/9] bg-zinc-900">
                {backdropUrl && (
                    <img src={backdropUrl} alt={movie.title || movie.name} className="w-full h-full object-cover" />
                )}
                {/* Dégradé pour fondre l'image vers le noir du body */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>

                {/* Bouton Retour Flottant */}
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

                {/* Bouton Favori (Cœur) top right */}
                {movie.status_local === "watched" &&
                    <button
                        onClick={() => {
                            triggerVibration([30, 100, 30])
                            mutation.mutate({ newStatus: movie.status_local, isFavorite: !movie.is_favorite, rewatch_count: movie.rewatch_count })
                        }}
                        className={`absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full text-white transition bg-black/40 hover:bg-black/60 aspect-square`}
                    >
                        {movie.is_favorite ? '❤️' : '🤍'}
                    </button>
                }
            </div>

            {/* CONTENU DU FILM */}
            <div className="px-4 -mt-10 sm:-mt-16 relative z-10 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
                    {movie.title || movie.name}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-400 mb-6">
                    <span className="bg-zinc-800/80 px-2 py-1 rounded-md text-zinc-200">{year}</span>
                    {formattedRuntime && <span>⏱ {formattedRuntime}</span>}
                    {movie.vote_average !== undefined && movie.vote_average > 0 && <span className="text-amber-400">⭐️ {movie.vote_average.toFixed(1)}/10</span>}

                    {/* Dates de visionnage */}
                    {movie.status_local === 'watched' && movie.created_at && (
                        <span className="ml-auto bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
                            1er vu : {new Date(movie.created_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                    {movie.status_local === 'watched' && movie.rewatch_count > 0 && movie.updated_at && (
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
                            Revu : {new Date(movie.updated_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                </div>

                {/* Boutons d'Action Rapide */}
                <div className="flex gap-3 mb-8">
                    {movie.status_local === 'watched' ? (
                        <>
                            {/* Bouton État : Déjà vu (Clic pour passer en not_tracked) */}
                            <button
                                onClick={() => {
                                    triggerVibration([50, 80, 20]);
                                    mutation.mutate({ newStatus: 'not_tracked', isFavorite: movie.is_favorite, rewatch_count: movie.rewatch_count })
                                }}
                                className="flex-[2] py-3 rounded-xl font-bold text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 transition-all"
                            >
                                ✅ Déjà vu
                            </button>

                            {/* Bloc Compteur */}
                            <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-700 p-1">
                                {/* Bouton Moins */}
                                <button
                                    onClick={() => {
                                        triggerVibration();
                                        mutation.mutate({
                                            newStatus: 'watched',
                                            isFavorite: movie.is_favorite,
                                            rewatch_count: Math.max(0, (movie.rewatch_count || 0) - 1)
                                        })
                                    }}
                                    disabled={(movie.rewatch_count || 0) <= 0}
                                    className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                                >
                                    <svg width="12" height="2" viewBox="0 0 12 2" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="1" x2="11" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>

                                {/* Chiffre */}
                                <span className="w-15 text-center font-bold text-sm font-mono text-white">
                                    x{movie.rewatch_count + 1 || 1}
                                </span>

                                {/* Bouton Plus */}
                                <button
                                    onClick={() => {
                                        triggerVibration();
                                        mutation.mutate({
                                            newStatus: 'watched',
                                            isFavorite: movie.is_favorite,
                                            rewatch_count: (movie.rewatch_count || 0) + 1
                                        })
                                    }}
                                    className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-white transition"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Mode standard : pas encore vu */}
                            <button
                                onClick={() => {
                                    const newStatus = movie.status_local === 'watchlist' ? 'not_tracked' : 'watchlist'

                                    if (newStatus === 'watchlist') {
                                        triggerVibration([20, 80, 50]);
                                    } else {
                                        triggerVibration([50, 80, 20]);
                                    }

                                    mutation.mutate({ newStatus: newStatus, isFavorite: movie.is_favorite, rewatch_count: movie.rewatch_count })
                                }}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${movie.status_local === 'watchlist'
                                    ? 'bg-purple-500 text-black hover:bg-purple-400'
                                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                    }`}
                            >
                                {movie.status_local === 'watchlist' ? '➖ Retirer' : '➕ À voir'}
                            </button>

                            <button
                                onClick={() => {
                                    triggerVibration([20, 80, 50]);
                                    mutation.mutate({ newStatus: 'watched', isFavorite: movie.is_favorite, rewatch_count: movie.rewatch_count })
                                }}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
                            >
                                👁️ Marquer vu
                            </button>
                        </>
                    )}
                </div>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-3">Genres</h2>
                        <div className="flex flex-wrap gap-2">
                            {movie.genres.map(genre => (
                                <span key={genre.id} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tagline & Synopsis */}
                {movie.tagline && (
                    <p className="italic text-zinc-400 text-sm mb-4">"{movie.tagline}"</p>
                )}
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-2">Synopsis</h2>
                    <p className="text-zinc-300 text-sm leading-relaxed opacity-90">{movie.overview || "Aucun synopsis disponible."}</p>
                </div>

                {/* Bloc Informations : Statut, Budget, Revenus */}
                <div className="grid grid-cols-3 gap-4 mb-8 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50">
                    <div>
                        <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Statut</h3>
                        <p className="text-zinc-200 text-sm font-medium">{movie.status || 'Inconnu'}</p>
                    </div>
                    <div>
                        <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Budget</h3>
                        <p className="text-zinc-200 text-sm font-medium">{formatCurrency(movie.budget)}</p>
                    </div>
                    <div>
                        <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Box-Office</h3>
                        <p className="text-zinc-200 text-sm font-medium">{formatCurrency(movie.revenue)}</p>
                    </div>
                </div>

                {/* Studios de Production */}
                {movie.production_companies && movie.production_companies.length > 0 && (
                    <div className="mb-10">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-3">Studios</h2>
                        <div className="flex flex-wrap gap-3">
                            {movie.production_companies.map(company => (
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

                {/* SECTION VIDÉOS */}
                <MediaTrailers videos={movie.videos?.results} />

                {/* SECTION DISTRIBUTION (CASTING) */}
                <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">
                        Distribution
                    </h2>

                    {isCreditsLoading ? (
                        <div className="flex gap-4 overflow-x-hidden">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="w-24 flex-shrink-0">
                                    <div className="w-24 aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />
                                    <div className="h-3 bg-zinc-900 rounded mt-2 w-5/6 animate-pulse" />
                                    <div className="h-2 bg-zinc-900 rounded mt-1 w-2/3 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : credits?.cast && credits.cast.length > 0 ? (
                        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-none snap-x">
                            {credits.cast.slice(0, 15).map((actor: any) => (
                                <div key={actor.id} className="w-24 flex-shrink-0 snap-start">
                                    <div className="w-24 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/40 relative shadow-sm">
                                        <img
                                            src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : 'https://dummyimage.com/200x300?text=No+Photo'}
                                            alt={actor.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                    <p className="text-xs font-semibold mt-2 text-zinc-200 line-clamp-1 leading-tight">{actor.name}</p>
                                    <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5 leading-none">{actor.character}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-4 rounded-xl text-center border border-dashed border-zinc-800">
                            Aucune information sur la distribution disponible.
                        </div>
                    )}
                </div>

                {/* SECTION FILMS SIMILAIRES */}
                <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">
                        Films similaires
                    </h2>

                    {isSimilarLoading ? (
                        <div className="flex gap-3 overflow-x-hidden">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="w-28 h-40 bg-zinc-900 rounded-xl animate-pulse flex-shrink-0" />
                            ))}
                        </div>
                    ) : similarMovies && similarMovies.length > 0 ? (
                        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-none snap-x">
                            {similarMovies.map((similarMovie) => (
                                <div key={similarMovie.id} className="w-28 flex-shrink-0 snap-start">
                                    <MediaCard
                                        item={similarMovie}
                                        layout="card"
                                        fallbackMediaType={mediaType}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-4 rounded-xl text-center border border-dashed border-zinc-800">
                            Aucune recommandation disponible pour ce film.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};