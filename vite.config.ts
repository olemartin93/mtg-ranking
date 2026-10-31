import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Only talk to Scryfall; added at build time so the dev server's inline scripts still work.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://cards.scryfall.io https://svgs.scryfall.io",
  "connect-src 'self' https://api.scryfall.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// GitHub Pages serves the app from /<repo-name>/
const base = process.env.BASE_PATH ?? '/mtg-ranking/';

export default defineConfig({
  base,
  plugins: [
    react(),
    csp(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Magic: ranked',
        short_name: 'Magic: ranked',
        description: 'MTG card search, upcoming releases, deck builder with synergy analysis, and popularity rankings.',
        lang: 'en',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // Card data: try the network first, fall back to cache when offline.
            urlPattern: ({ url }) => url.origin === 'https://api.scryfall.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'scryfall-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Card images and set symbols rarely change: cache first.
            urlPattern: ({ url }) => url.origin === 'https://cards.scryfall.io' || url.origin === 'https://svgs.scryfall.io',
            handler: 'CacheFirst',
            options: {
              cacheName: 'scryfall-images',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
