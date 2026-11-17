import { Check } from 'lucide-react';
import { dismissToast, useToast } from '../utils/toast';
import { triggerVibration } from '../utils/haptics';

// Affiche le toast courant juste au-dessus de la barre de navigation
export const Toaster = () => {
    const toast = useToast();
    if (!toast) return null;

    return (
        <div
            className="fixed inset-x-0 z-[65] flex justify-center px-4 pointer-events-none"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
            role="status"
            aria-live="polite"
        >
            <div
                key={toast.id}
                className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl shadow-black/60 [animation:toast-in_0.35s_cubic-bezier(0.2,0.9,0.3,1.2)]"
            >
                <div className="flex items-center gap-3 p-2.5 pr-3">
                    {toast.posterPath ? (
                        <div className="relative flex-shrink-0">
                            <img
                                src={`https://image.tmdb.org/t/p/w92${toast.posterPath}`}
                                alt=""
                                className="w-9 aspect-[2/3] rounded-md object-cover"
                            />
                            <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-black ring-2 ring-zinc-900 [animation:toast-check_0.45s_cubic-bezier(0.2,0.9,0.3,1.4)_0.1s_both]">
                                <Check size={12} strokeWidth={3.5} />
                            </span>
                        </div>
                    ) : (
                        <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-black [animation:toast-check_0.45s_cubic-bezier(0.2,0.9,0.3,1.4)_0.1s_both]">
                            <Check size={18} strokeWidth={3} />
                        </span>
                    )}

                    <button onClick={dismissToast} className="min-w-0 flex-1 text-left" aria-label="Fermer la notification">
                        <p className="text-sm font-bold text-white leading-tight">{toast.title}</p>
                        {toast.subtitle && <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{toast.subtitle}</p>}
                    </button>

                    {toast.action && (
                        <button
                            onClick={() => {
                                triggerVibration(15);
                                toast.action?.onClick();
                                dismissToast();
                            }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-300 hover:bg-purple-500/15 transition-colors"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>

                {/* Temps restant avant disparition */}
                <div
                    className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/70 origin-left"
                    style={{ width: '100%', animation: `toast-timer ${toast.durationMs}ms linear forwards` }}
                />
            </div>
        </div>
    );
};
