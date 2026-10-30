import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

// Pour TanStack Query, l'app n'est "en ligne" que si le réseau est là ET que Clerk est prêt (jeton disponible).
// Sinon, une action en attente partirait sans authentification, échouerait et serait perdue.
let authReady = false;
let notifyOnlineManager: ((online: boolean) => void) | null = null;

const canReachApi = () => authReady && navigator.onLine;

onlineManager.setEventListener(setOnline => {
    notifyOnlineManager = setOnline;
    const update = () => setOnline(canReachApi());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
    };
});

export const setAuthReady = (ready: boolean) => {
    authReady = ready;
    notifyOnlineManager?.(canReachApi());
};

// --- État du réseau pour l'interface ---
const subscribeNetwork = (callback: () => void) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
    };
};

export const useNetworkStatus = () => useSyncExternalStore(subscribeNetwork, () => navigator.onLine);
