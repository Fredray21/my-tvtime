import React, { useRef, useState } from 'react';
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

// Note perso : 5 étoiles. On tape une étoile puis on glisse le doigt : la note suit par demi-étoile
// (moitié gauche = demi-point). Enregistrée au relâchement ; retaper la note actuelle sans glisser l'efface.
export const RatingStars: React.FC<RatingStarsProps> = ({ value, onChange, size = 30 }) => {
    const [draft, setDraft] = useState<number | null>(null);
    const starsRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ start: number; moved: boolean } | null>(null);
    const current = value ?? 0;
    const shown = draft ?? current;

    // Position du doigt -> note sur 10, en se basant sur la position réelle de chaque étoile
    const valueAt = (clientX: number) => {
        const stars = starsRef.current?.children;
        if (!stars) return 1;
        for (let i = 0; i < stars.length; i++) {
            const rect = stars[i].getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) return i * 2 + 1;
            if (clientX <= rect.right) return i * 2 + 2;
        }
        return 10;
    };

    const move = (next: number) => {
        if (next !== shown) triggerVibration([8]);
        setDraft(next);
    };

    const save = (next: number | null) => {
        setDraft(null);
        if (next === (value ?? null)) return;
        triggerVibration(next === null ? [20] : [12, 30, 12]);
        onChange(next);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const start = valueAt(e.clientX);
        gesture.current = { start, moved: false };
        move(start);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!gesture.current) return;
        const next = valueAt(e.clientX);
        if (next !== gesture.current.start) gesture.current.moved = true;
        move(next);
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const g = gesture.current;
        if (!g) return;
        gesture.current = null;
        const next = valueAt(e.clientX);
        // Simple tap sur la note déjà donnée : on l'efface
        save(!g.moved && next === current ? null : next);
    };

    const onPointerCancel = () => {
        gesture.current = null;
        setDraft(null);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (step) {
            e.preventDefault();
            save(Math.min(10, Math.max(1, current + step)));
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            save(null);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <div
                ref={starsRef}
                role="slider"
                tabIndex={0}
                aria-label="Ta note"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={current}
                aria-valuetext={current > 0 ? `${formatRating(current)} sur 5` : 'Pas noté'}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                className="flex items-center gap-1 cursor-pointer select-none touch-pan-y rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
            >
                {STARS.map(star => {
                    const fill = shown >= star * 2 ? 1 : shown === star * 2 - 1 ? 0.5 : 0;
                    return (
                        <span key={star} className="relative inline-flex pointer-events-none" style={{ width: size, height: size }}>
                            <Star size={size} className="text-zinc-700" strokeWidth={1.5} />
                            {fill > 0 && (
                                <span className="absolute inset-0 overflow-hidden" style={{ width: fill === 1 ? '100%' : '50%' }}>
                                    <Star size={size} className="text-amber-400" fill="currentColor" strokeWidth={1.5} />
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>
            <span className="min-w-[3.5rem] text-sm font-bold tabular-nums text-zinc-200">
                {shown > 0 ? <>{formatRating(shown)}<span className="text-zinc-500 font-medium">/5</span></> : <span className="text-zinc-500 font-medium">Pas noté</span>}
            </span>
            {value != null && draft === null && (
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
