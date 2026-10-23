// Kopiert Vosk-Worker und WASM aus node_modules nach public/vosk/,
// damit sie same-origin ausgeliefert und vom Service Worker gecacht werden.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@lichess-org/vosk-browser/dist');
const dest = join(root, 'public/vosk');

if (!existsSync(src)) {
  console.warn('[copy-vosk] @lichess-org/vosk-browser nicht installiert – übersprungen');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of ['vosk.worker.js', 'vosk.wasm']) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log('[copy-vosk] vosk.worker.js + vosk.wasm → public/vosk/');
