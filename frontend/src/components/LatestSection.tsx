import React from 'react';
import { Link } from 'react-router-dom';
import type { MediaCustomResponse } from '../api/mediaApi';
import { MediaCard } from './MediaCard';

interface LatestSectionProps {
    title: string;
    data?: MediaCustomResponse[]
    isLoading: boolean;
    emptyMessage?: string;
    viewAllLink?: string;
}

export const LatestSection: React.FC<LatestSectionProps> = ({
    title,
    data,
    isLoading,
    emptyMessage = "Aucun contenu pour le moment...",
    viewAllLink = "#"
}) => {
    return (
        <div className="mt-8">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {title}
                </h3>
                {data && data.length > 0 && (
                    <Link to={viewAllLink} className="text-[16px] text-purple-500 font-bold hover:underline">
                        Voir tout
                    </Link>
                )}
            </div>

            {isLoading ? (
                <div className="flex gap-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="w-28 h-40 bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : data && data.length > 0 ? (
                <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-none snap-x">
                    {data.map((item) => (
                        <div key={item.id} className="w-28 flex-shrink-0 snap-start">
                            <MediaCard item={item} layout="card" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-zinc-600 text-xs italic p-4 text-center border border-dashed border-zinc-800 rounded-xl">
                    {emptyMessage}
                </div>
            )}
        </div>
    );
};