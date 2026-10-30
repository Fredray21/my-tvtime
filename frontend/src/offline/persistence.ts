import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import type { Query } from '@tanstack/react-query';

// Les données consultées restent disponibles hors ligne pendant 7 jours
export const OFFLINE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

// À incrémenter si la forme des données change : l'ancien cache local est alors ignoré
export const CACHE_BUSTER = 'v1';

const CACHE_KEY = 'mytvtime-query-cache';
const SESSION_KEY = 'mytvtime-offline-session';

// Cache des requêtes stocké dans IndexedDB (bien plus de place que localStorage)
export const queryPersister = createAsyncStoragePersister({
    storage: {
        getItem: (key) => get<string>(key).then(value => value ?? null),
        setItem: (key, value) => set(key, value),
        removeItem: (key) => del(key),
    },
    key: CACHE_KEY,
    throttleTime: 1000,
});

// Requêtes inutiles hors ligne (recherche, récap annuel lourd) : pas besoin de les garder
const NOT_PERSISTED = new Set(['search-multi', 'search-paged', 'wrapped', 'pushConfig']);

export const shouldPersistQuery = (query: Query) =>
    query.state.status === 'success' && !NOT_PERSISTED.has(String(query.queryKey[0]));

// --- Session hors ligne ---
// Clerk ne fonctionne pas sans réseau : on retient qu'un utilisateur était connecté sur cet appareil
// (et de quoi afficher son profil) pour ouvrir l'app avec les données en cache.
export interface OfflineSession {
    fullName: string | null;
    email: string | null;
    imageUrl: string | null;
}

export const saveOfflineSession = (session: OfflineSession) => {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        // stockage indisponible : le mode hors ligne ne sera simplement pas proposé
    }
};

export const readOfflineSession = (): OfflineSession | null => {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as OfflineSession) : null;
    } catch {
        return null;
    }
};

// À la déconnexion : plus aucune donnée personnelle ne reste sur l'appareil
export const clearOfflineData = async () => {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch {
        // rien à nettoyer
    }
    await del(CACHE_KEY).catch(() => undefined);
};
