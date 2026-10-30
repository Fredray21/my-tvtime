import type { createUserApi } from '../api/userApi';

type UserApi = ReturnType<typeof createUserApi>;

// Choix de l'utilisateur sur CET appareil (le navigateur peut perdre l'abonnement, pas ce choix)
const ENABLED_KEY = 'push_notifications_enabled';

export const isPushSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Sur iPhone / iPad, le push web n'existe que si l'app est installée sur l'écran d'accueil (iOS 16.4+)
export const isIOSWithoutInstall = () => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return isIOS && !isStandalone;
};

const readEnabledFlag = () => {
    try {
        return localStorage.getItem(ENABLED_KEY) === 'true';
    } catch {
        return false;
    }
};

const writeEnabledFlag = (enabled: boolean) => {
    try {
        localStorage.setItem(ENABLED_KEY, String(enabled));
    } catch {
        // stockage indisponible (navigation privée) : sans conséquence
    }
};

// La clé publique VAPID est en base64 "url-safe" : le navigateur l'attend en octets
const base64UrlToBytes = (base64Url: string) => {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, char => char.charCodeAt(0));
};

const sameKey = (subscription: PushSubscription, publicKey: Uint8Array) => {
    const current = subscription.options.applicationServerKey;
    if (!current) return false;
    const currentBytes = new Uint8Array(current);
    return currentBytes.length === publicKey.length && currentBytes.every((byte, i) => byte === publicKey[i]);
};

// Pas de service worker en mode dev (vite) : uniquement sur le build de prod / preview
const getRegistration = async () => {
    if (!isPushSupported()) return null;
    return (await navigator.serviceWorker.getRegistration()) ?? null;
};

// Crée (ou recrée) l'abonnement avec la clé actuelle du serveur et l'enregistre côté API
const ensureSubscription = async (api: UserApi, registration: ServiceWorkerRegistration) => {
    const config = await api.getPushConfig();
    if (!config.enabled || !config.public_key) throw new Error('Notifications non configurées sur le serveur');

    const publicKey = base64UrlToBytes(config.public_key);
    let subscription = await registration.pushManager.getSubscription();

    // Clés VAPID changées côté serveur : on se réabonne, sans redemander l'autorisation
    if (subscription && !sameKey(subscription, publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
    }

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey,
        });
    }

    await api.subscribePush(subscription.toJSON());
    return subscription;
};

export type PushStatus = 'unsupported' | 'ios_install_required' | 'no_service_worker' | 'denied' | 'enabled' | 'disabled';

export const getPushStatus = async (): Promise<PushStatus> => {
    if (isIOSWithoutInstall()) return 'ios_install_required';
    if (!isPushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const registration = await getRegistration();
    if (!registration) return 'no_service_worker';
    const subscription = await registration.pushManager.getSubscription();
    return subscription && readEnabledFlag() ? 'enabled' : 'disabled';
};

export const enablePush = async (api: UserApi) => {
    const registration = await getRegistration();
    if (!registration) throw new Error("Service worker indisponible (l'app doit être installée ou servie en production)");

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Autorisation refusée');

    await ensureSubscription(api, registration);
    writeEnabledFlag(true);
};

export const disablePush = async (api: UserApi) => {
    writeEnabledFlag(false);
    const registration = await getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    await api.unsubscribePush(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
};

// À chaque ouverture de l'app : si l'utilisateur a activé les notifications sur cet appareil,
// on vérifie que l'abonnement existe toujours, avec la bonne clé, et que le serveur le connaît
export const syncPushSubscription = async (api: UserApi) => {
    if (!readEnabledFlag() || !isPushSupported() || Notification.permission !== 'granted') return;

    const registration = await getRegistration();
    if (!registration) return;

    try {
        await ensureSubscription(api, registration);
    } catch (err) {
        console.warn('Synchronisation des notifications impossible :', err);
    }
};
