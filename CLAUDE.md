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
- `src/caller/` – TTS, Caller-Stile, synthetische Soundeffekte. Während TTS/Clips laufen, bekommt der Recognizer kein Audio (+300 ms).
  Ansagen sind Bausteine (`Cue`: Text + optional Clip-Schlüssel). `src/caller/voicepack.ts` ist die **einzige Quelle**
  für Clip-Schlüssel, Texte und Intensität (`scoreLevel`): je höher die Punktzahl, desto mehr Emotion und Lautheit.

### Klang-Paket (eigene Ansagerstimme)

- `public/voices/oche-de|oche-en/` – AAC-Clips + `manifest.json`, im Git. Erzeugt lokal mit Chatterbox (MIT),
  eigene synthetische Stimme, keine Imitation realer Caller. Fehlende Clips spricht die Systemstimme.
- Neu erzeugen: `npx tsx scripts/voicepack/export-spec.ts`, dann
  `.cache/tts-venv/bin/python scripts/voicepack/generate.py de` (bzw. `en`). Bestehende Clips werden übersprungen –
  zum Neuerzeugen Datei löschen oder `--only key1,key2`. Jeder Clip wird per Vosk zurückgehört (Bericht:
  `.cache/voicepack-<lang>-report.json`). Einrichtung der Python-Umgebung siehe `scripts/voicepack/README.md`.
- `src/platform/` – Feature-Detection für Wake Lock, `navigator.audioSession`, Lifecycle. Nie Browser-Sniffing.
- `src/store/` – Zustand-Stores; `src/db/` – Dexie (IndexedDB), Export/Import JSON.
- `src/engine/bot.ts` – Bot simuliert Einzeldarts; `skillFor()` per Simulation kalibriert (±10 % Test).
- `src/app/training.ts` – Checkout-Training/121 als Einzel-X01-Runden (`kind`), Around the Clock über Controller-Hooks.
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
| E2E                            | `npm run e2e` (UI auf 4 Viewports, dann Sprache seriell)      |
| Nur Sprach-E2E (Fake-Mikro)    | `npm run e2e:voice` (braucht `npm run model`)                 |
| Typen / Lint / Format          | `npm run typecheck` · `npm run lint` · `npm run format`       |
| Test-WAVs erzeugen             | `npm run test-audio`                                          |
| Build                          | `npm run build` (für Pages: `BASE_PATH=/oche/ npm run build`) |
| Deploy                         | Push auf `main` → GitHub Action → GitHub Pages                |

## Konventionen

- TypeScript strict, **kein `any`**, `noUncheckedIndexedAccess`. Nur löschbare TS-Syntax (keine `enum`s).
- Engine-Code: pure Funktionen, jede Regel mit Vitest-Test.
- UI-Texte Deutsch, aktiv, kurz. Ansagen in `src/caller/phrases.*.ts`, nicht im UI-Code verstreut.
- Kleine Commits pro Teilschritt.
