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