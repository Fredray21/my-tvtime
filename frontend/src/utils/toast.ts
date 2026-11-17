import { useSyncExternalStore } from 'react';

// Petite notification à l'écran ("toast"), sans contexte React : on peut l'appeler depuis n'importe quel handler.
export interface Toast {
    id: number;
    title: string;
    subtitle?: string;
    posterPath?: string | null;
    action?: { label: string; onClick: () => void };
    durationMs: number;
}

type Listener = () => void;

let current: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(listener => listener());

export const dismissToast = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    current = null;
    emit();
};

// Un seul toast à la fois : le nouveau remplace l'ancien
export const showToast = (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => {
    if (timer) clearTimeout(timer);
    current = { durationMs: 4000, ...toast, id: nextId++ };
    timer = setTimeout(dismissToast, current.durationMs);
    emit();
};

const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const useToast = () => useSyncExternalStore(subscribe, () => current);

// Texte commun aux actions faites hors ligne
export const offlineHint = () =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'Hors ligne : synchronisé au retour du réseau' : undefined;
