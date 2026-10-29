import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import type { WatchProvider } from '../api/mediaApi';

interface WatchProvidersProps {
    id: number;
    mediaType: 'movie' | 'tv';
}

const SECTIONS = [
    { key: 'flatrate', label: 'Streaming' },
    { key: 'free', label: 'Gratuit' },
    { key: 'ads', label: 'Avec pub' },
    { key: 'rent', label: 'Location' },
    { key: 'buy', label: 'Achat' },
] as const;

export const WatchProviders: React.FC<WatchProvidersProps> = ({ id, mediaType }) => {
    const api = useApi();

    const { data, isLoading } = useQuery({
        queryKey: [mediaType, 'providers', id],
        queryFn: () => api.media.getWatchProviders(id, mediaType),
        enabled: !isNaN(id),
        staleTime: 1000 * 60 * 60 * 12, // Les catalogues bougent peu : 12h
    });

    if (isLoading) {
        return (
            <div className="mb-8">
                <div className="h-3 w-28 bg-zinc-900 rounded mb-3 animate-pulse" />
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-11 h-11 bg-zinc-900 rounded-xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    const sections = SECTIONS
        .map(section => ({ ...section, providers: [...(data?.[section.key] ?? [])].sort((a, b) => a.display_priority - b.display_priority) }))
        .filter(section => section.providers.length > 0);

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Où regarder</h2>
                {data?.link && (
                    <a
                        href={data.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider"
                    >
                        Toutes les offres <ExternalLink size={10} />
                    </a>
                )}
            </div>

            {sections.length > 0 ? (
                <div className="flex flex-col gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50">
                    {sections.map(section => (
                        <div key={section.key} className="flex items-center gap-3">
                            <span className="w-16 flex-shrink-0 text-zinc-500 text-[10px] uppercase tracking-wider font-medium">{section.label}</span>
                            <div className="flex flex-wrap gap-2">
                                {section.providers.map((provider: WatchProvider) => (
                                    <img
                                        key={provider.provider_id}
                                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                        alt={provider.provider_name}
                                        title={provider.provider_name}
                                        className="w-10 h-10 rounded-xl border border-zinc-800 object-cover"
                                        loading="lazy"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                    <p className="text-[9px] text-zinc-600 mt-1">Disponibilités en France · Données JustWatch</p>
                </div>
            ) : (
                <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-4 rounded-xl text-center border border-dashed border-zinc-800">
                    Disponible sur aucune plateforme en France pour le moment.
                </div>
            )}
        </div>
    );
};
