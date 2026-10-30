import { registerSW } from 'virtual:pwa-register';

// Vérifie une nouvelle version au plus toutes les 5 min quand l'app revient au premier plan
const MIN_CHECK_INTERVAL = 5 * 60 * 1000;
const PERIODIC_CHECK = 60 * 60 * 1000;

// Enregistrement du service worker avec mise à jour automatique.
// En mode "autoUpdate", la page se recharge d'elle-même dès que la nouvelle version a pris le contrôle.
export const setupPwaUpdates = () => {
    let lastCheck = 0;

    registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
            if (!registration) return;

            const checkForUpdate = () => {
                if (Date.now() - lastCheck < MIN_CHECK_INTERVAL || !navigator.onLine) return;
                lastCheck = Date.now();
                registration.update().catch(() => undefined);
            };

            // Sur mobile, rouvrir la PWA la reprend souvent depuis la mémoire, sans navigation :
            // sans ça, le navigateur ne cherche jamais de mise à jour
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') checkForUpdate();
            });
            setInterval(checkForUpdate, PERIODIC_CHECK);
        },
    });
};
