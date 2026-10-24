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

// Silero-VAD (S4): ONNX-Laufzeit + Modell, ebenfalls same-origin und offline cachebar
const ortSrc = join(root, 'node_modules/onnxruntime-web/dist');
const vadSrc = join(root, 'node_modules/@ricky0123/vad-web/dist');
if (existsSync(ortSrc) && existsSync(vadSrc)) {
  const ortDest = join(root, 'public/ort');
  mkdirSync(ortDest, { recursive: true });
  for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
    copyFileSync(join(ortSrc, file), join(ortDest, file));
  }
  copyFileSync(join(vadSrc, 'silero_vad_v5.onnx'), join(ortDest, 'silero_vad_v5.onnx'));
  console.log('[copy-vosk] ONNX-Laufzeit + silero_vad_v5.onnx → public/ort/');
}
