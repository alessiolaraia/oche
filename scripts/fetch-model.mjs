// Lädt das deutsche Vosk-Small-Modell, packt es als .tar.gz für vosk-browser
// nach public/models/ und extrahiert die Wortliste aus graph/Gr.fst
// (das Modell hat keine words.txt; die Symboltabelle steckt im FST-Header).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODEL_NAME = 'vosk-model-small-de-0.15';
const MODEL_URL = `https://alphacephei.com/vosk/models/${MODEL_NAME}.zip`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache');
const outDir = join(root, 'public/models');
const tarball = join(outDir, `${MODEL_NAME}.tar.gz`);
const wordsFile = join(outDir, `${MODEL_NAME}.words.txt`);

mkdirSync(cache, { recursive: true });
mkdirSync(outDir, { recursive: true });

const zip = join(cache, `${MODEL_NAME}.zip`);
const modelDir = join(cache, MODEL_NAME);

if (!existsSync(zip)) {
  console.log(`[model] lade ${MODEL_URL} …`);
  execFileSync('curl', ['-fL', '--retry', '3', '-o', zip, MODEL_URL], { stdio: 'inherit' });
}
if (!existsSync(modelDir)) {
  execFileSync('unzip', ['-q', '-o', zip, '-d', cache], { stdio: 'inherit' });
}
if (!existsSync(tarball)) {
  // COPYFILE_DISABLE verhindert macOS-AppleDouble-Dateien (._*) im Archiv
  execFileSync('tar', ['-czf', tarball, '-C', cache, MODEL_NAME], {
    stdio: 'inherit',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  console.log(`[model] ${tarball}`);
}

/** Liest die Ausgabe-Symboltabelle aus einem OpenFST-Header. */
function readFstWords(path) {
  const fd = openSync(path, 'r');
  const buf = Buffer.alloc(16 * 1024 * 1024);
  readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const marker = buf.indexOf('words.txt');
  if (marker < 0) throw new Error('Keine Symboltabelle in Gr.fst gefunden');
  let i = marker + 'words.txt'.length;
  i += 8; // available key
  const n = Number(buf.readBigInt64LE(i));
  i += 8;
  const words = [];
  for (let k = 0; k < n; k++) {
    const len = buf.readInt32LE(i);
    i += 4;
    words.push(buf.toString('utf8', i, i + len));
    i += len + 8; // Wort + int64-Schlüssel
  }
  return words;
}

if (!existsSync(wordsFile)) {
  const words = readFstWords(join(modelDir, 'graph/Gr.fst'));
  writeFileSync(wordsFile, words.join('\n') + '\n');
  console.log(`[model] ${words.length} Wörter → ${wordsFile}`);
}

// Kontrolle: ein paar Pflichtwörter
const vocab = new Set(readFileSync(wordsFile, 'utf8').split('\n'));
const missing = ['wurf', 'hundert', 'sechzig', 'überworfen', 'zurück'].filter((w) => !vocab.has(w));
if (missing.length) {
  console.error('[model] fehlende Pflichtwörter:', missing);
  process.exit(1);
}
