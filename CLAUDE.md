# Oche – sprachgesteuerter Darts-Scorer

## Ziel

PWA für Steeldarts: Mikro dauerhaft an, „Wurf sechzig“ → 60 abziehen, Rest laut ansagen. Gerät liegt 2–3 m entfernt.
Gleiches Verhalten auf MacBook (Chrome/Safari) und Handy (iOS Home-Screen-App, Android Chrome).
Spezifikation: `docs/MASTERPROMPT.md`. Antworten an den User: Deutsch, knapp.

**Definition of Done:** komplettes Match 501 / Double-Out / First to 3 aus 2,5 m nur per Stimme, inkl. Korrektur und Bust.

## Architektur

- `src/engine/` – reine Funktionen, keine UI/DOM-Abhängigkeit. **Event-Sourcing**: der Spielstand ist
  `reduce(events, config)`. Undo/Korrektur = Events entfernen/ersetzen, nie Zustand mutieren.
- `src/voice/numbers.de.ts` – **einzige Quelle** für deutsche Zahlwörter: erzeugt Vosk-Grammatik _und_ Parser.
- `src/voice/` – `SpeechEngine`-Interface; `voskEngine` (primär, offline, Grammatik) und `webSpeechEngine` (Fallback).
  Audio: getUserMedia → Gain → Compressor → Noise Gate → AudioWorklet (16 kHz) → Vosk-Worker.
- `src/caller/` – TTS, Caller-Stile, synthetische Soundeffekte. Während TTS spricht, bekommt der Recognizer kein Audio (+300 ms).
- `src/platform/` – Feature-Detection für Wake Lock, `navigator.audioSession`, Lifecycle. Nie Browser-Sniffing.
- `src/store/` – Zustand-Stores; `src/db/` – Dexie (IndexedDB), Export/Import JSON.
- `src/ui/` – React-Screens; Hash-Routing (`#/debug`), damit GitHub Pages ohne Rewrites läuft.

### Vosk-Modell

- `vosk-model-small-de-0.15` hat **keine `words.txt`**; `scripts/fetch-model.mjs` liest die Symboltabelle aus
  `graph/Gr.fst` → `public/models/<model>.words.txt`.
- Nur 40 von 101 Komposita „hundertX“ sind im Vokabular → Grammatik nutzt für 101–180 „hundert X“ und nur
  vorhandene Komposita. „bust“ fehlt im Vokabular (nur „überworfen“ in der Grammatik).
- Vosk speichert das entpackte Modell selbst in IndexedDB (IDBFS) → nach erstem Laden offline. Der Service Worker
  cacht daher nur Worker/WASM/App, nicht das 45-MB-Archiv.
- Modell und `public/vosk/` sind nicht im Git: `npm run vosk` kopiert Worker/WASM (npm 11 blockiert postinstall), `npm run model` lädt das Modell.

## Befehle

| Zweck                          | Befehl                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Einrichten                     | `npm install && npm run vosk && npm run model`                |
| Dev (Mac)                      | `npm run dev`                                                 |
| Dev im WLAN fürs Handy (HTTPS) | `npm run dev:phone` → `https://<Mac-IP>:5173`                 |
| Unit-Tests                     | `npm test`                                                    |
| E2E                            | `npm run e2e` (baut + preview auf :4173)                      |
| Typen / Lint / Format          | `npm run typecheck` · `npm run lint` · `npm run format`       |
| Test-WAVs erzeugen             | `npm run test-audio`                                          |
| Build                          | `npm run build` (für Pages: `BASE_PATH=/oche/ npm run build`) |
| Deploy                         | Push auf `main` → GitHub Action → GitHub Pages                |

## Konventionen

- TypeScript strict, **kein `any`**, `noUncheckedIndexedAccess`. Nur löschbare TS-Syntax (keine `enum`s).
- Engine-Code: pure Funktionen, jede Regel mit Vitest-Test.
- UI-Texte Deutsch, aktiv, kurz. Ansagen in `src/caller/phrases.*.ts`, nicht im UI-Code verstreut.
- Kleine Commits pro Teilschritt.
