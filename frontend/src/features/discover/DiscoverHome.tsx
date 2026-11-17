import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Flame, Star, Tv } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { useMyPlatforms } from '../../hooks/useMyPlatforms';
import { MediaCard } from '../../components/MediaCard';
import type { DiscoverItem } from '../../api/searchApi';
import { DISCOVER_LISTS, type DiscoverListDef } from './discoverLists';

interface DiscoverHomeProps {
    // Onglet de la recherche : on ne garde que les rangées du bon type
    filter: 'all' | 'movie' | 'tv';
}

// Page affichée sous la barre de recherche tant qu'aucune recherche n'est tapée
export const DiscoverHome: React.FC<DiscoverHomeProps> = ({ filter }) => {
    const { hasPlatforms, isLoading: isPlatformsLoading } = useMyPlatforms();
    const rows = DISCOVER_LISTS.filter(def => (filter === 'all' || def.mediaType === filter) && (!def.requiresPlatforms || hasPlatforms));
    const heroType = filter === 'tv' ? 'tv' : 'movie';

    return (
        <div className="flex flex-col gap-9">
            <TrendingHero key={heroType} mediaType={heroType} />
            {rows.map((def, i) => (
                <React.Fragment key={`${def.mediaType}-${def.list}`}>
                    <DiscoverRow def={def} />
                    {/* Invitation à choisir ses plateformes, à la place de leurs rangées */}
                    {i === 1 && !hasPlatforms && !isPlatformsLoading && <PlatformsPrompt />}
                </React.Fragment>
            ))}
        </div>
    );
};

const PlatformsPrompt = () => (
    <Link
        to="/settings"
        className="flex items-center gap-3 p-4 rounded-2xl border border-purple-500/25 bg-purple-500/10 hover:bg-purple-500/15 transition-colors"
    >
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex-shrink-0">
            <Tv size={20} />
        </span>
        <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-zinc-100">Quelles plateformes as-tu ?</span>
            <span className="block text-xs text-zinc-400">Choisis tes abonnements pour voir ce qui y est inclus, partout dans l'app.</span>
        </span>
        <ChevronRight size={18} className="text-zinc-500 flex-shrink-0" />
    </Link>
);

// --- Bandeau : top 5 des tendances, qui défile tout seul ---
const HERO_COUNT = 5;
const HERO_INTERVAL_MS = 6000;

const TrendingHero: React.FC<{ mediaType: 'movie' | 'tv' }> = ({ mediaType }) => {
    const api = useApi();
    const [index, setIndex] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['discover', mediaType, 'trending', 1],
        queryFn: () => api.search.getDiscoverList(mediaType, 'trending', 1),
        staleTime: 1000 * 60 * 60,
    });

    const slides = (data?.results ?? []).filter(item => item.backdrop_path).slice(0, HERO_COUNT);

    useEffect(() => {
        if (slides.length < 2) return;
        const timer = setInterval(() => setIndex(i => (i + 1) % slides.length), HERO_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [slides.length]);

    if (isLoading) return <div className="aspect-[16/10] sm:aspect-[21/9] max-h-[380px] w-full rounded-2xl bg-zinc-900 animate-pulse" />;
    if (slides.length === 0) return null;

    const current = slides[index % slides.length];

    return (
        <div className="relative aspect-[16/10] sm:aspect-[21/9] max-h-[380px] w-full rounded-2xl overflow-hidden ring-1 ring-white/5 shadow-2xl shadow-black/50">
            {slides.map((item, i) => (
                <img
                    key={item.id}
                    src={`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index % slides.length ? 'opacity-100' : 'opacity-0'}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 to-transparent" />

            <Link
                key={current.id}
                to={`/${mediaType}/${current.id}`}
                className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex flex-col gap-1.5 [animation:picker-fade-up_0.5s_ease-out]"
            >
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                    <Flame size={13} /> N°{(index % slides.length) + 1} des tendances
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white line-clamp-1">
                    {current.title || current.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                    {!!current.vote_average && (
                        <span className="flex items-center gap-1"><Star size={11} fill="currentColor" className="text-amber-400" /> {current.vote_average.toFixed(1)}</span>
                    )}
                    {(current.release_date || current.first_air_date) && (
                        <span>{new Date(current.release_date || current.first_air_date || '').getFullYear()}</span>
                    )}
                </div>
                {current.overview && (
                    <p className="text-xs sm:text-sm text-zinc-300/90 line-clamp-2 max-w-xl">{current.overview}</p>
                )}
            </Link>

            <div className="absolute top-3 right-3 flex gap-1">
                {slides.map((item, i) => (
                    <button
                        key={item.id}
                        onClick={() => setIndex(i)}
                        aria-label={`Afficher la tendance n°${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${i === index % slides.length ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                    />
                ))}
            </div>
        </div>
    );
};

// --- Rangée horizontale (avec "Tout voir") ---
const DiscoverRow: React.FC<{ def: DiscoverListDef }> = ({ def }) => {
    const api = useApi();
    const { data, isLoading } = useQuery({
        queryKey: ['discover', def.mediaType, def.list, 1],
        queryFn: () => api.search.getDiscoverList(def.mediaType, def.list, 1),
        staleTime: 1000 * 60 * 60,
    });

    const items: DiscoverItem[] = (data?.results ?? []).slice(0, def.ranked ? 10 : 20);
    if (!isLoading && items.length === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-base font-bold tracking-tight text-zinc-100">{def.title}</h2>
                <Link
                    to={`/discover/${def.mediaType}/${def.list}`}
                    className="flex items-center gap-0.5 text-xs font-semibold text-zinc-500 hover:text-purple-400 transition-colors"
                >
                    Tout voir <ChevronRight size={14} />
                </Link>
            </div>

            <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-none snap-x scroll-px-4">
                {isLoading
                    ? [...Array(6)].map((_, i) => (
                        <div key={i} className="w-28 flex-shrink-0 aspect-[2/3] rounded-xl bg-zinc-900 animate-pulse" />
                    ))
                    : items.map((item, i) => def.ranked ? (
                        <div key={item.id} className="flex items-end flex-shrink-0 snap-start">
                            <span
                                aria-hidden
                                className="text-[88px] leading-[0.75] font-black text-zinc-950 [-webkit-text-stroke:2px_rgb(82_82_91)] -mr-4 mb-[40px] select-none tabular-nums"
                            >
                                {i + 1}
                            </span>
                            <div className="w-28 relative">
                                <MediaCard item={item} layout="card" fallbackMediaType={def.mediaType} showStatusBadge />
                            </div>
                        </div>
                    ) : (
                        <div key={item.id} className="w-28 flex-shrink-0 snap-start">
                            <MediaCard item={item} layout="card" fallbackMediaType={def.mediaType} showStatusBadge />
                        </div>
                    ))}
            </div>
        </section>
    );
};
