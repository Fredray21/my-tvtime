import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Tv } from 'lucide-react';
import { providerLogoUrl, useMyPlatforms, usePlatformCatalog, useSetMyPlatforms } from '../hooks/useMyPlatforms';
import { triggerVibration } from '../utils/haptics';

// Nombre de plateformes affichées avant "Voir toutes" (les plus populaires en France d'abord)
const TOP_COUNT = 15;

// Réglages : choix des plateformes auxquelles on est abonné
export const MyPlatformsSettings = () => {
    const { data: catalog, isLoading, isError } = usePlatformCatalog();
    const { selectedIds } = useMyPlatforms();
    const setPlatforms = useSetMyPlatforms();
    const [showAll, setShowAll] = useState(false);
    const [query, setQuery] = useState('');

    const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

    const visible = useMemo(() => {
        if (!catalog) return [];
        const search = query.trim().toLowerCase();
        if (search) return catalog.filter(p => p.provider_name.toLowerCase().includes(search));
        if (showAll) return catalog;
        // Les plateformes déjà choisies restent visibles même si elles ne sont pas dans le top
        const top = catalog.slice(0, TOP_COUNT);
        const extra = catalog.slice(TOP_COUNT).filter(p => selected.has(p.provider_id));
        return [...top, ...extra];
    }, [catalog, query, showAll, selected]);

    const toggle = (id: number) => {
        triggerVibration(selected.has(id) ? [10] : [15, 30, 15]);
        const next = selected.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
        setPlatforms.mutate(next);
    };

    return (
        <>
            <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mes plateformes</h2>
                {selectedIds.length > 0 && (
                    <span className="text-[11px] font-semibold text-purple-300">{selectedIds.length} choisie{selectedIds.length > 1 ? 's' : ''}</span>
                )}
            </div>
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="flex items-start gap-2 text-xs text-zinc-400 mb-4">
                    <Tv size={14} className="mt-0.5 flex-shrink-0 text-zinc-500" />
                    Tes abonnements : on te montre ce qui est inclus dedans sur les fiches, ta liste, le tirage au sort et Découvrir.
                </p>

                {isLoading ? (
                    <div className="grid grid-cols-5 gap-3">
                        {[...Array(10)].map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-zinc-800 animate-pulse" />)}
                    </div>
                ) : isError || !catalog ? (
                    <p className="text-sm text-zinc-500 text-center py-4">Impossible de charger les plateformes pour le moment.</p>
                ) : (
                    <>
                        {showAll && (
                            <label className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus-within:border-purple-500/60">
                                <Search size={14} className="text-zinc-500" />
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Chercher une plateforme"
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                                />
                            </label>
                        )}

                        <div className="grid grid-cols-4 min-[400px]:grid-cols-5 gap-x-3 gap-y-4">
                            {visible.map(provider => {
                                const isOn = selected.has(provider.provider_id);
                                return (
                                    <button
                                        key={provider.provider_id}
                                        type="button"
                                        onClick={() => toggle(provider.provider_id)}
                                        aria-pressed={isOn}
                                        className="group flex flex-col items-center gap-1.5 min-w-0"
                                    >
                                        <span className={`relative w-full aspect-square rounded-2xl overflow-hidden transition-all ${isOn ? 'ring-2 ring-purple-400 shadow-[0_0_16px_rgb(168_85_247_/_0.35)]' : 'ring-1 ring-zinc-800 opacity-60 grayscale-[40%] group-hover:opacity-100 group-hover:grayscale-0'}`}>
                                            <img src={providerLogoUrl(provider.logo_path, 'w154')} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            {isOn && (
                                                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-black">
                                                    <Check size={10} strokeWidth={4} />
                                                </span>
                                            )}
                                        </span>
                                        <span className={`w-full text-[10px] leading-tight text-center line-clamp-2 ${isOn ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}>
                                            {provider.provider_name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {visible.length === 0 && <p className="text-sm text-zinc-500 text-center py-4">Aucune plateforme ne correspond.</p>}

                        {catalog.length > TOP_COUNT && (
                            <button
                                type="button"
                                onClick={() => { triggerVibration([10]); setShowAll(v => !v); setQuery(''); }}
                                className="mt-4 w-full flex items-center justify-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                            >
                                {showAll ? 'Voir moins' : `Voir toutes les plateformes (${catalog.length})`}
                                <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
                            </button>
                        )}

                        {setPlatforms.isError && (
                            <p className="mt-3 text-xs text-red-400 text-center">L'enregistrement a échoué, réessaie une fois connecté.</p>
                        )}
                    </>
                )}
            </div>
        </>
    );
};
