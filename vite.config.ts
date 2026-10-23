import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH wird im GitHub-Pages-Build auf /<repo>/ gesetzt.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    react(),
    // `--mode https` → selbstsigniertes Zertifikat, damit das Handy im WLAN Mikrofonzugriff bekommt
    ...(mode === 'https' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'vosk/vosk.worker.js', 'vosk/vosk.wasm', 'worklets/*.js'],
      manifest: {
        name: 'Oche – Darts per Stimme zählen',
        short_name: 'Oche',
        description: 'Sprachgesteuerter Darts-Scorer: „Wurf sechzig“ sagen, Rest hören.',
        lang: 'de',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1a1714',
        theme_color: '#1a1714',
        categories: ['sports', 'games', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Das Modell (45 MB) cacht Vosk selbst entpackt in IndexedDB – nicht doppelt im SW.
        globIgnores: ['models/**', 'voices/**'],
        runtimeCaching: [
          // Klang-Paket: Clips ändern sich nie (neue Version = neuer Schlüsselsatz), Manifest frisch halten
          {
            urlPattern: ({ url }) => url.pathname.includes('/voices/') && url.pathname.endsWith('.m4a'),
            handler: 'CacheFirst',
            options: { cacheName: 'oche-voices' },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/voices/') && url.pathname.endsWith('manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'oche-voices-manifest', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.words.txt'),
            handler: 'CacheFirst',
            options: { cacheName: 'oche-vocab' },
          },
        ],
      },
    }),
  ],
  server: { host: mode === 'https' ? true : undefined },
  test: {
    include: ['test/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
}));
