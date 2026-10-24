# Sprachsystem: Ist/Soll gegen `docs/VOICE_MASTERPROMPT.md`

Stand vor dem Umbau (Commit `8390239`). Ziel ist die Messlatte aus §0: ≥ 97 % richtige Befehle aus 2,5 m,
≤ 1 Falsch-Annahme in 30 min Gerede, ≤ 700 ms bis zur Ansage, keine unbemerkte Verwechslung (16↔60 …).

## Was es gibt

| Stufe | Umsetzung heute | Datei |
|---|---|---|
| S1 Capture | `echoCancellation` an, Rauschunterdrückung/AGC umschaltbar, iOS `audioSession = play-and-record` | `src/voice/audio/pipeline.ts`, `src/platform/audioSession.ts` |
| S2 DSP | Gain (0–30 dB) → WebAudio-Kompressor → AudioWorklet mit **Boxcar-Downsampling** auf 16 kHz | `pipeline.ts`, `public/worklets/oche-processor.js` |
| S4 VAD | Energie-Gate im Worklet: 120 ms Vorlauf, 400 ms Hold, außerhalb Nullen | `oche-processor.js` |
| S5 Vosk | Grammatik + `[unk]`, `setWords(true)`, Mittelwert der Wort-Konfidenzen; Partials nur fürs UI | `src/voice/voskEngine.ts`, `src/voice/control.ts` |
| S6 Lexikon | Zahlen 0–180 aus **einer** Quelle (`numbers.de.ts`), Befehle in `commands.ts`; Grammatik nur aus Wörtern im Modellvokabular (Test + Laufzeitwarnung) | `src/voice/numbers.de.ts`, `src/voice/commands.ts` |
| S8 | unmögliche Scores, Bogeys, Checkout mit zu wenigen Darts → abgelehnt | `src/engine/rules.ts` |
| S9 | TTS + Vollbild-Blitz, 3-s-Fenster für „Nein“, „Zurück“/„Korrektur“ | `src/app/controller.ts`, `src/caller/` |
| Echo | Während TTS/Clips bekommt Vosk Stille, +300 ms Nachlauf | `src/voice/echo.ts` |
| Kalibrierung | Abstand + Raumlautstärke → Gain/Gate/Mindest-Sicherheit; „Automatisch messen“ (Raum + Satz) | `src/voice/audio/calibrationMath.ts` |
| Debug | `#/debug`: Engine, Pegel, Gate, letzte 20 Rohergebnisse mit Konfidenz | `src/ui/screens/Debug.tsx` |
| Tests | 6 Sprach-E2E: `say`-WAVs als Fake-Mikro durch die echte Pipeline (Chromium), inkl. Match und Gerede | `test/e2e/voice/` |

## Was fehlt

- **S1:** `voiceIsolation`, Mikrofon-Auswahl, Anzeige der tatsächlich aktiven Constraints (`getSettings()`).
- **S2:** Hochpass ~120 Hz, Limiter, Tiefpass vor dem Downsampling, optionaler Denoiser mit A/B-Messung.
- **S3:** Einschlag-Erkennung komplett.
- **S4:** echte VAD (Silero), Pre-Roll 300–400 ms, Segmentgrenzen, adaptiver Rauschboden.
- **S5:** Partials für frühe Entscheidung, getrennte (strengere) Trigger-Konfidenz, Englisch-Modell zur Laufzeit.
- **S6:** Aliase („zwo“, „nix“, „drüber“, gelernte), Hilfe-Seite „Was kann ich sagen?“, Build-Fehler statt Warnung,
  Property-Based-Tests.
- **S7:** Zustandsautomat – heute wird jedes Final-Ergebnis einzeln geparst.
- **S8:** Verwechslungspaare mit Rückfrage, Kontext-Priorisierung (Rest = 60 macht 60 wahrscheinlicher).
- **S9:** Lern-Log in IndexedDB, Alias-Vorschläge, adaptive Schwellen.
- **Kalibrierung:** Einschläge einmessen, 10 Testsätze mit Trefferquote, A/B, Trigger-Robustheit, Profile.
- **Debug:** Pegel je Stufe, VAD-Wahrscheinlichkeit, Automatenzustand, Entscheidungsgrund, 10-s-WAV-Export.
- **Eval:** Testkorpus (Befehle, Negative, Verwechslungen), Kennzahlen, Sweep, CI-Schwelle.

## Fehleranfällig heute

1. **Boxcar-Downsampling** filtert schlecht → Aliasing (hohe Frequenzen falten sich ins Sprachband).
2. **Kein Hochpass:** tiefe Anteile von Einschlägen und Trittschall öffnen das Gate und landen in der Erkennung.
3. **Gate statt VAD:** laute Musik oder Gespräche über der Schwelle gehen komplett an Vosk; die Grammatik presst sie
   in Zahlen. Das `[unk]`-Ventil hilft, ersetzt aber keine VAD.
4. **Zweistufiger Trigger fehlt:** „Wurf … (Pause) … sechzig“ wird zu zwei Ergebnissen, keines davon zählt.
5. **Keine Entprellung:** dasselbe Ergebnis kann theoretisch doppelt gebucht werden (z. B. Partial + Final, sobald
   Partials genutzt werden).
6. **16↔60 & Co.** werden ohne Rückfrage übernommen, auch bei knapper Konfidenz.
7. **Kennzahlen fehlen:** Ob eine Änderung besser oder schlechter ist, sieht man heute nicht.

## Vorgehen

Siehe Phasenplan im Masterprompt (§10): zuerst Korpus + Eval-Runner, damit jede Änderung messbar ist. Neues hinter
Feature-Flags (`settings.voice.flags`), Standard aus, bis die Eval es bestätigt.
