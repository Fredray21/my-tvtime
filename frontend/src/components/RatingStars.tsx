import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { triggerVibration } from '../utils/haptics';
import { formatRating } from '../utils/rating';

interface RatingStarsProps {
    // Note sur 10 (1 = une demi-étoile, 10 = cinq étoiles), null si pas notée
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    size?: number;
}

const STARS = [1, 2, 3, 4, 5];

// Note perso : 5 étoiles, moitié gauche d'une étoile = demi-point. Retaper la note actuelle l'efface.
export const RatingStars: React.FC<RatingStarsProps> = ({ value, onChange, size = 30 }) => {
    const [hover, setHover] = useState<number | null>(null);
    const current = value ?? 0;
    const shown = hover ?? current;

    const pick = (next: number) => {
        triggerVibration(next === current ? [20] : [12, 30, 12]);
        onChange(next === current ? null : next);
    };

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Ta note" onMouseLeave={() => setHover(null)}>
                {STARS.map(star => {
                    const fill = shown >= star * 2 ? 1 : shown === star * 2 - 1 ? 0.5 : 0;
                    return (
                        <span key={star} className="relative inline-flex" style={{ width: size, height: size }}>
                            <Star size={size} className="text-zinc-700" strokeWidth={1.5} />
                            {fill > 0 && (
                                <span className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: fill === 1 ? '100%' : '50%' }}>
                                    <Star size={size} className="text-amber-400" fill="currentColor" strokeWidth={1.5} />
                                </span>
                            )}
                            {/* Deux zones de clic : demi-étoile à gauche, étoile entière à droite */}
                            {[star * 2 - 1, star * 2].map((half, i) => (
                                <button
                                    key={half}
                                    type="button"
                                    role="radio"
                                    aria-checked={current === half}
                                    aria-label={`${formatRating(half)} sur 5`}
                                    onMouseEnter={() => setHover(half)}
                                    onFocus={() => setHover(half)}
                                    onBlur={() => setHover(null)}
                                    onClick={() => pick(half)}
                                    className={`absolute top-0 h-full w-1/2 ${i === 0 ? 'left-0' : 'right-0'} rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400`}
                                />
                            ))}
                        </span>
                    );
                })}
            </div>
            <span className="min-w-[3.5rem] text-sm font-bold tabular-nums text-zinc-200">
                {shown > 0 ? <>{formatRating(shown)}<span className="text-zinc-500 font-medium">/5</span></> : <span className="text-zinc-500 font-medium">Pas noté</span>}
            </span>
            {value != null && hover === null && (
                <button
                    type="button"
                    onClick={() => { triggerVibration([20]); onChange(null); }}
                    aria-label="Effacer ma note"
                    className="ml-auto p-1.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

// Bloc "Ta note" des fiches film / série
export const PersonalRating: React.FC<{ value: number | null | undefined; onChange: (value: number | null) => void }> = ({ value, onChange }) => (
    <div className="mb-8 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Ta note</h2>
        <RatingStars value={value} onChange={onChange} />
    </div>
);
