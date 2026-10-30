import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically updates the app when a new version is deployed
      injectRegister: false, // Enregistrement fait dans src/pwa.ts (vérification au retour au premier plan + rechargement auto)
      workbox: {
        importScripts: ['push-sw.js'], // Réception et affichage des notifications push (public/push-sw.js)
        clientsClaim: true, // la nouvelle version prend la main tout de suite
        skipWaiting: true,
        // Affiches TMDB gardées en cache pour l'affichage hors ligne (taille limitée, purge si l'espace manque)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/image\.tmdb\.org\/t\/p\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'My TV Time Dashboard',
        short_name: 'MyTVTime',
        description: 'Personal dashboard to track my movies and TV shows',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone', // Forces full-screen standalone mobile app mode
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Ensures the icon scales perfectly on Android adaptive launchers
          }
        ]
      }
    })
  ],
  server: {
    port: 3000 // Local development port
  }
})