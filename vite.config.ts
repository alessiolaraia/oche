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
      includeAssets: ['icons/*.png', 'icons/*.svg', 'vosk/vosk.worker.js', 'vosk/vosk.wasm'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Das Modell (45 MB) cacht Vosk selbst entpackt in IndexedDB – nicht doppelt im SW.
        globIgnores: ['models/**'],
        runtimeCaching: [
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
