import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Dices, Eye, RotateCcw, Sparkles, Star, Tv, X } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import type { MediaCustomResponse, WatchProvider } from '../../api/mediaApi';
import { providerLogoUrl, useMyPlatforms } from '../../hooks/useMyPlatforms';
import { triggerVibration } from '../../utils/haptics';

interface WatchlistPickerProps {
    mediaType: 'movie' | 'tv';
    onClose: () => void;
}

type Phase = 'setup' | 'spinning' | 'result';
type DurationFilter = 'any' | 'short' | 'medium';
type TvFilter = 'any' | 'watching' | 'watchlist';

// Géométrie de la bande d'affiches (en px)
const SLOT_WIDTH = 112;
const SLOT_GAP = 12;
const SLOT_STEP = SLOT_WIDTH + SLOT_GAP;
const REEL_LENGTH = 42;
const WINNER_INDEX = 36;
const SPIN_DURATION_MS = 4200;

const DURATIONS: { id: DurationFilter; label: string; max: number }[] = [
    { id: 'any', label: 'Peu importe', max: Infinity },
    { id: 'short', label: '< 1h45', max: 105 },
    { id: 'medium', label: '< 2h15', max: 135 },
];

const TV_FILTERS: { id: TvFilter; label: string }[] = [
    { id: 'any', label: 'Toutes' },
    { id: 'watching', label: 'En cours' },
    { id: 'watchlist', label: 'À commencer' },
];

const CONFETTI_COLORS = ['#a855f7', '#c084fc', '#f59e0b', '#10b981', '#f43f5e', '#ffffff'];

const posterUrl = (path?: string | null, size = 'w342') =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : 'https://dummyimage.com/342x513?text=No+Poster';

const REEL_POSTER_SIZE = 'w185';
const PRELOAD_TIMEOUT_MS = 1200;

// Charge les images en cache navigateur (sans bloquer plus d'une seconde si le réseau est lent)
const preloadPosters = (urls: string[]) => {
    const loads = [...new Set(urls)].map(url => new Promise<void>(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = url;
    }));
    return Promise.race([
        Promise.all(loads),
        new Promise(resolve => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
    ]);
};

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Récupère toute la liste "À voir" (toutes les pages) pour tirer au sort parmi l'ensemble
const useWholeWatchlist = (mediaType: 'movie' | 'tv') => {
    const api = useApi();
    return useQuery({
        queryKey: ['watchlist', mediaType, 'picker-all'],
        queryFn: async () => {
            const all: MediaCustomResponse[] = [];
            for (let page = 1; page <= 50; page++) {
                const res = await api.media.getWatchlist(page, mediaType);
                all.push(...res.results);
                if (!res.has_next_page) break;
            }
            return Array.from(new Map(all.map(item => [item.id, item])).values());
        },
        staleTime: 1000 * 60 * 5,
    });
};

export const WatchlistPicker: React.FC<WatchlistPickerProps> = ({ mediaType, onClose }) => {
    const { data: watchlist, isLoading } = useWholeWatchlist(mediaType);

    const [phase, setPhase] = useState<Phase>('setup');
    const [duration, setDuration] = useState<DurationFilter>('any');
    const [tvFilter, setTvFilter] = useState<TvFilter>('any');
    const [genreId, setGenreId] = useState<number | null>(null);
    const [onMyPlatforms, setOnMyPlatforms] = useState(false);
    const { hasPlatforms, myProvidersFor } = useMyPlatforms();

    const [reel, setReel] = useState<MediaCustomResponse[]>([]);
    const [winner, setWinner] = useState<MediaCustomResponse | null>(null);
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(false);
    const [centerIndex, setCenterIndex] = useState(0);

    const viewportRef = useRef<HTMLDivElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    // Films déjà sortis / séries qui restent à regarder
    const basePool = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return (watchlist ?? []).filter(item => mediaType === 'movie'
            ? item.status_local === 'watchlist' && (!item.release_date || item.release_date <= today)
            : item.status_local === 'watchlist' || item.status_local === 'watching');
    }, [watchlist, mediaType]);

    // Genres les plus représentés dans la liste
    const genres = useMemo(() => {
        const counts = new Map<number, { id: number; name: string; count: number }>();
        basePool.forEach(item => item.genres?.forEach(g => {
            const entry = counts.get(g.id) ?? { ...g, count: 0 };
            entry.count++;
            counts.set(g.id, entry);
        }));
        return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    }, [basePool]);

    const pool = useMemo(() => {
        const maxRuntime = DURATIONS.find(d => d.id === duration)?.max ?? Infinity;
        return basePool.filter(item => {
            if (genreId !== null && !item.genres?.some(g => g.id === genreId)) return false;
            if (mediaType === 'movie' && maxRuntime !== Infinity && (!item.runtime || item.runtime > maxRuntime)) return false;
            if (mediaType === 'tv' && tvFilter !== 'any' && item.status_local !== tvFilter) return false;
            if (onMyPlatforms && myProvidersFor(item.available_on).length === 0) return false;
            return true;
        });
    }, [basePool, duration, genreId, tvFilter, mediaType, onMyPlatforms, myProvidersFor]);

    // Nombre de titres de la liste inclus dans mes abonnements (affiché sur le filtre)
    const onPlatformsCount = useMemo(
        () => basePool.filter(item => myProvidersFor(item.available_on).length > 0).length,
        [basePool, myProvidersFor],
    );

    // Fermeture : Échap + blocage du défilement de la page derrière
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [onClose]);

    const centerOffsetFor = (index: number) => {
        const viewportWidth = viewportRef.current?.clientWidth ?? window.innerWidth;
        return viewportWidth / 2 - (index * SLOT_STEP + SLOT_WIDTH / 2);
    };

    // Petit "tic" haptique à chaque affiche qui passe au centre, comme une roue de loterie
    const trackTicks = () => {
        const strip = stripRef.current;
        if (!strip) return;
        let last = -1;
        const loop = () => {
            const x = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41;
            const rounded = Math.max(0, Math.round((centerOffsetFor(0) - x) / SLOT_STEP));
            if (rounded !== last) {
                last = rounded;
                setCenterIndex(rounded);
                triggerVibration(6);
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
    };

    const stopTicks = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    const spin = async () => {
        if (pool.length === 0) return;

        // On évite de retomber sur le même film en relançant
        const candidates = pool.length > 1 && winner ? pool.filter(item => item.id !== winner.id) : pool;
        const picked = candidates[Math.floor(Math.random() * candidates.length)];

        // Le remplissage de la roue n'utilise que des films avec affiche (plus joli qu'une case grise)
        const fillers = pool.filter(item => item.poster_path);
        const fillerPool = fillers.length > 0 ? fillers : pool;
        const sequence = Array.from({ length: REEL_LENGTH }, (_, i) =>
            i === WINNER_INDEX ? picked : fillerPool[Math.floor(Math.random() * fillerPool.length)]
        );

        triggerVibration([15, 40, 15]);
        setWinner(picked);
        setReel(sequence);
        setCenterIndex(0);

        if (prefersReducedMotion()) {
            setPhase('result');
            return;
        }

        setPhase('spinning');
        setAnimate(false);
        setOffset(centerOffsetFor(0));

        // Les affiches doivent être prêtes avant que la roue ne tourne, sinon on voit des cases vides
        await preloadPosters(sequence.map(item => posterUrl(item.poster_path, REEL_POSTER_SIZE)));

        // Deux frames : le navigateur pose la position de départ avant de lancer la transition
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setAnimate(true);
            setOffset(centerOffsetFor(WINNER_INDEX));
            trackTicks();
        }));
    };

    const handleSpinEnd = (e: React.TransitionEvent) => {
        if (e.target !== stripRef.current || phase !== 'spinning') return;
        stopTicks();
        setCenterIndex(WINNER_INDEX);
        triggerVibration([30, 60, 80]);
        setTimeout(() => setPhase('result'), 450);
    };

    const label = mediaType === 'movie' ? 'film' : 'série';

    return createPortal(
        <div className="fixed inset-0 z-[70] bg-zinc-950/95 backdrop-blur-xl flex flex-col text-white [animation:picker-fade-up_0.25s_ease-out]" role="dialog" aria-modal="true" aria-label="Je choisis pour toi">
            {/* Lueur d'ambiance */}
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/20 blur-3xl" />

            <div className="relative flex items-center justify-between px-4 pt-6 pb-2 max-w-3xl w-full mx-auto">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                    <Sparkles size={18} className="text-purple-400" /> Je choisis pour toi
                </h2>
                <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className={`relative flex-1 overflow-y-auto overflow-x-hidden ${phase === 'result' ? '' : 'pb-10'}`}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-zinc-500 gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                        Je parcours ta liste...
                    </div>
                ) : phase === 'result' && winner ? (
                    <WinnerReveal winner={winner} mediaType={mediaType} onRespin={spin} canRespin={pool.length > 1} myProviders={myProvidersFor(winner.available_on)} />
                ) : (
                    <>
                        {/* Bande d'affiches */}
                        <div ref={viewportRef} className="relative mt-4 h-[236px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
                            {phase === 'spinning' ? (
                                <div
                                    ref={stripRef}
                                    onTransitionEnd={handleSpinEnd}
                                    className="absolute top-8 left-0 flex will-change-transform"
                                    style={{
                                        gap: SLOT_GAP,
                                        transform: `translateX(${offset}px)`,
                                        transition: animate ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.1, 0.75, 0.15, 1)` : 'none',
                                    }}
                                >
                                    {reel.map((item, i) => (
                                        <img
                                            key={i}
                                            src={posterUrl(item.poster_path, REEL_POSTER_SIZE)}
                                            alt=""
                                            className={`flex-shrink-0 aspect-[2/3] object-cover rounded-xl transition-all duration-150 ${i === centerIndex ? 'scale-110 ring-2 ring-purple-400 shadow-[0_0_20px_rgb(168_85_247_/_0.45)]' : 'scale-95 opacity-60'}`}
                                            style={{ width: SLOT_WIDTH }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <IdleDeck items={pool.length > 0 ? pool : basePool} />
                            )}
                            {/* Repère central */}
                            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-[10px] border-t-purple-400" />
                        </div>

                        {/* Filtres */}
                        <div className={`max-w-xl mx-auto px-4 mt-8 flex flex-col gap-5 transition-opacity ${phase === 'spinning' ? 'opacity-30 pointer-events-none' : ''}`}>
                            {mediaType === 'movie' ? (
                                <FilterGroup label="Durée">
                                    {DURATIONS.map(d => (
                                        <Chip key={d.id} active={duration === d.id} onClick={() => setDuration(d.id)}>
                                            {d.id !== 'any' && <Clock size={12} />} {d.label}
                                        </Chip>
                                    ))}
                                </FilterGroup>
                            ) : (
                                <FilterGroup label="Séries">
                                    {TV_FILTERS.map(f => (
                                        <Chip key={f.id} active={tvFilter === f.id} onClick={() => setTvFilter(f.id)}>{f.label}</Chip>
                                    ))}
                                </FilterGroup>
                            )}

                            {hasPlatforms && (
                                <FilterGroup label="Où ?">
                                    <Chip active={!onMyPlatforms} onClick={() => setOnMyPlatforms(false)}>Partout</Chip>
                                    <Chip active={onMyPlatforms} onClick={() => setOnMyPlatforms(true)}>
                                        <Tv size={12} /> Sur mes plateformes <span className="opacity-70 tabular-nums">({onPlatformsCount})</span>
                                    </Chip>
                                </FilterGroup>
                            )}

                            {genres.length > 1 && (
                                <FilterGroup label="Envie de...">
                                    <Chip active={genreId === null} onClick={() => setGenreId(null)}>Tout</Chip>
                                    {genres.map(g => (
                                        <Chip key={g.id} active={genreId === g.id} onClick={() => setGenreId(g.id)}>{g.name}</Chip>
                                    ))}
                                </FilterGroup>
                            )}

                            <p className="text-center text-xs text-zinc-500">
                                {pool.length === 0
                                    ? `Aucun(e) ${label} ne correspond à ces filtres.`
                                    : `${pool.length} ${label}${pool.length > 1 ? 's' : ''} dans le chapeau`}
                            </p>

                            <button
                                onClick={spin}
                                disabled={pool.length === 0 || phase === 'spinning'}
                                className="mx-auto flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-purple-500 text-black font-black text-base shadow-lg shadow-purple-500/30 hover:bg-purple-400 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                            >
                                <Dices size={20} className={phase === 'spinning' ? 'animate-spin' : ''} />
                                {phase === 'spinning' ? 'Ça tourne...' : 'Lancer'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

// Générateur pseudo-aléatoire déterministe (mulberry32) : le rendu reste pur
const seededRandom = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CONFETTI_COUNT = 28;

const makeConfetti = (seed: number) => {
    const random = seededRandom(seed);
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + random() * 0.4;
        const distance = 120 + random() * 120;
        return {
            dx: `${Math.cos(angle) * distance}px`,
            dy: `${Math.sin(angle) * distance - 40}px`,
            rot: `${random() * 720 - 360}deg`,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            delay: random() * 120,
            round: i % 3 === 0,
        };
    });
};

// Éventail d'affiches au repos, avant le lancer
const IdleDeck: React.FC<{ items: MediaCustomResponse[] }> = ({ items }) => {
    const deck = items.filter(item => item.poster_path).slice(0, 5);
    if (deck.length === 0) return null;
    const middle = (deck.length - 1) / 2;
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            {deck.map((item, i) => {
                const delta = i - middle;
                return (
                    <img
                        key={item.id}
                        src={posterUrl(item.poster_path, REEL_POSTER_SIZE)}
                        alt=""
                        className="absolute aspect-[2/3] object-cover rounded-xl ring-1 ring-white/10 shadow-[0_4px_12px_rgb(0_0_0_/_0.55)] transition-transform duration-500"
                        style={{
                            width: SLOT_WIDTH,
                            // Éventail légèrement remonté : les cartes penchées et leur ombre restent dans la zone (rognée en bas)
                            transform: `translateX(${delta * 52}px) translateY(${Math.abs(delta) * 6 - 14}px) rotate(${delta * 7}deg)`,
                            zIndex: 10 - Math.abs(Math.round(delta)),
                        }}
                    />
                );
            })}
        </div>
    );
};

const WinnerReveal: React.FC<{
    winner: MediaCustomResponse;
    mediaType: 'movie' | 'tv';
    onRespin: () => void;
    canRespin: boolean;
    myProviders: WatchProvider[];
}> = ({ winner, mediaType, onRespin, canRespin, myProviders }) => {
    const title = winner.title || winner.name || 'Sans titre';
    const date = winner.release_date || winner.first_air_date;
    const year = date ? new Date(date).getFullYear() : null;
    const runtime = mediaType === 'movie' ? winner.runtime : winner.episode_run_time?.[0];

    // Confettis : salve différente (mais stable) pour chaque gagnant
    const confetti = useMemo(() => makeConfetti(winner.id), [winner.id]);

    return (
        <div key={winner.id} className="flex flex-col items-center px-6 pt-4 [@media(min-height:760px)]:pt-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-300 mb-4 [animation:picker-fade-up_0.4s_ease-out]">
                Ce soir, tu regardes
            </p>

            <div className="relative">
                <div className="pointer-events-none absolute left-1/2 top-1/2">
                    {confetti.map((c, i) => (
                        <span
                            key={i}
                            className={`motion-safe-anim absolute w-2 h-3 ${c.round ? 'rounded-full w-2 h-2' : 'rounded-sm'}`}
                            style={{
                                backgroundColor: c.color,
                                ['--dx' as string]: c.dx,
                                ['--dy' as string]: c.dy,
                                ['--rot' as string]: c.rot,
                                animation: `picker-confetti 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) ${c.delay}ms forwards`,
                            }}
                        />
                    ))}
                </div>
                <Link to={`/${mediaType}/${winner.id}`} className="block">
                    <img
                        src={posterUrl(winner.poster_path, 'w500')}
                        alt={title}
                        className="motion-safe-anim w-36 [@media(min-height:760px)]:w-44 sm:w-52 aspect-[2/3] object-cover rounded-2xl ring-2 ring-purple-400/70 [animation:picker-reveal_0.6s_cubic-bezier(0.2,0.9,0.3,1.2)_forwards,picker-glow_2.4s_ease-in-out_0.6s_infinite]"
                    />
                </Link>
            </div>

            <div className="mt-5 flex flex-col items-center gap-2 [animation:picker-fade-up_0.5s_ease-out_0.25s_both]">
                <h3 className="text-2xl font-black tracking-tight">{title}</h3>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                    {year && <span>{year}</span>}
                    {!!runtime && <span className="flex items-center gap-1"><Clock size={11} /> {Math.floor(runtime / 60) > 0 ? `${Math.floor(runtime / 60)}h${String(runtime % 60).padStart(2, '0')}` : `${runtime} min`}</span>}
                    {!!winner.vote_average && <span className="flex items-center gap-1"><Star size={11} fill="currentColor" className="text-amber-400" /> {winner.vote_average.toFixed(1)}</span>}
                    {mediaType === 'tv' && !!winner.next_episode_number && (
                        <span className="text-purple-300 font-semibold">Reprendre à S{winner.next_season_number} · E{winner.next_episode_number}</span>
                    )}
                </div>
                {winner.genres && winner.genres.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                        {winner.genres.slice(0, 3).map(g => (
                            <span key={g.id} className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">{g.name}</span>
                        ))}
                    </div>
                )}
                {myProviders.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[11px] font-semibold text-purple-200">
                        {myProviders.slice(0, 3).map(p => (
                            <img key={p.provider_id} src={providerLogoUrl(p.logo_path)} alt="" className="w-4 h-4 rounded" />
                        ))}
                        Inclus sur {myProviders.map(p => p.provider_name).join(', ')}
                    </div>
                )}
                {winner.overview && <p className="mt-1 text-sm text-zinc-400 line-clamp-2 [@media(min-height:760px)]:line-clamp-3 max-w-md">{winner.overview}</p>}
            </div>

            {/* Barre d'actions collée en bas : toujours visible, même sur un petit écran */}
            <div className="sticky bottom-0 mt-6 w-[calc(100%+3rem)] -mx-6 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-3 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent [animation:picker-fade-up_0.5s_ease-out_0.4s_both]">
                <Link
                    to={`/${mediaType}/${winner.id}`}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-500 text-black font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-400 active:scale-95 transition-all"
                >
                    <Eye size={18} /> Voir la fiche
                </Link>
                {canRespin && (
                    <button
                        onClick={onRespin}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold hover:bg-zinc-800 active:scale-95 transition-all"
                    >
                        <RotateCcw size={16} /> Relancer
                    </button>
                )}
            </div>
        </div>
    );
};

const FilterGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={() => { triggerVibration(8); onClick(); }}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active
            ? 'bg-purple-500 text-black border-purple-500'
            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}
    >
        {children}
    </button>
);
