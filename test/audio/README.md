# Test-Audio für den Sprach-E2E

Die Dateien hier laufen in Chromium als **Fake-Mikrofon** durch die echte Pipeline
(getUserMedia → Verstärkung → Kompressor → Noise Gate → AudioWorklet → Vosk):

```
--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<datei.wav>
```

| Datei              | Inhalt                                                                  | Test                             |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------- |
| `wurf-sechzig.wav` | dreimal „Wurf sechzig“                                                  | `test/e2e/voice/sechzig.spec.ts` |
| `befehle.wav`      | 141, 45 → Korrektur 60, Einzeldarts, Überworfen, Zurück, Rest           | `befehle.spec.ts`                |
| `smalltalk.wav`    | Gerede, auch „Sechzig Leute …“ ohne Triggerwort                         | `smalltalk.spec.ts`              |
| `match.wav`        | komplettes Match 501 / Double-Out / First to 3 inkl. Bust und Korrektur | `match.spec.ts`                  |

Neu erzeugen (macOS, Stimme „Anna“): `npm run test-audio` – mit anderer Stimme: `VOICE=Flo npm run test-audio`.

## Eigene Aufnahmen hinzufügen

1. **Aufnehmen**, am besten mit dem Handy aus 2,5 m am Board, mit echten Geräuschen (Einschläge, Gespräche).
   Jede Datei beginnt mit **mindestens 12 Sekunden Stille** (in der Zeit lädt das Modell aus dem Cache)
   und zwischen zwei Befehlen liegen **2–3 Sekunden Pause**.
2. **Umwandeln** in WAV, 16 kHz, mono, 16 bit, z. B. mit ffmpeg:
   ```
   ffmpeg -i aufnahme.m4a -ac 1 -ar 16000 -sample_fmt s16 test/audio/meine-aufnahme.wav
   ```
   oder mit macOS-Bordmitteln:
   ```
   afconvert -f WAVE -d LEI16@16000 -c 1 aufnahme.m4a test/audio/meine-aufnahme.wav
   ```
3. **Test anlegen**: `test/e2e/voice/sechzig.spec.ts` kopieren, `fakeMic('meine-aufnahme')` eintragen und
   die erwarteten Reste prüfen.
4. Laufen lassen: `npx playwright test test/e2e/voice --project=voice`

Voraussetzung: das Modell liegt in `public/models/` (`npm run model`).
