// Gestion des notifications push, importé dans le service worker généré par vite-plugin-pwa (workbox.importScripts)

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'My TV Time';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: data.icon || '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.tag, // même série = la notification précédente est remplacée au lieu de s'empiler
            renotify: !!data.tag,
            data: { url: data.url || '/' },
        })
    );
});

// Clic sur la notification : on réutilise un onglet / la PWA déjà ouverte si possible
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
