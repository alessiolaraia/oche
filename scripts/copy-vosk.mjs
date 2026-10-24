// Kopiert Vosk-Worker und WASM aus node_modules nach public/vosk/,
// damit sie same-origin ausgeliefert und vom Service Worker gecacht werden.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
// Wort-Konfidenzen ja, aber keine Wort-Details im Teilergebnis: Mit SetPartialWords(true) meldet Vosk ein Wort
// erst, wenn der Satz fertig ist (~1 s nach „Wurf“). Ohne kommt das Triggerwort ~80 ms nach dem Wortende.
const worker = join(dest, 'vosk.worker.js');
const PARTIAL_WORDS = 'recognizer.recognizer.SetPartialWords(value);';
const code = readFileSync(worker, 'utf8');
if (!code.includes(PARTIAL_WORDS)) throw new Error('[copy-vosk] SetPartialWords nicht gefunden – Worker-Patch anpassen');
writeFileSync(worker, code.replace(PARTIAL_WORDS, 'recognizer.recognizer.SetPartialWords(false);'));
console.log('[copy-vosk] vosk.worker.js + vosk.wasm → public/vosk/ (Teilergebnisse ohne Wort-Details)');

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
