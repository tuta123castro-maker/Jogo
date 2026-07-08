/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Open Markets',
        short_name: 'OpenMkts',
        description: 'A private paper-trading simulator.',
        start_url: '/',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app is client-routed (react-router); without this, opening a
        // deep link (e.g. /research) while offline has no cached response —
        // every unmatched navigation falls back to the precached app shell.
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than app code, so splitting it
        // out gets a returning visitor a cache hit on redeploy instead of
        // re-downloading React/Supabase every time the app ships a fix.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
})
