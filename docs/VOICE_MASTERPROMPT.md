# VOICE-MASTERPROMPT – Spracherkennung für „OCHE“ auf Profi-Niveau

> Du bist Claude Code. Die Darts-App existiert bereits. Dieser Prompt betrifft **nur das Sprachsystem**: Mikrofon, Filterung, Erkennung, Entscheidungslogik, Lernen, Tests.
> **Bevor du etwas änderst:**
> 1. Analysiere den bestehenden Code (Audio-Pipeline, Erkennung, Parser, Spiellogik-Schnittstelle).
> 2. Schreib mir einen kurzen Ist/Soll-Abgleich gegen diese Spezifikation (was gibt es, was fehlt, was ist fehleranfällig).
> 3. Starte im Plan Mode, dann Umsetzung in Phasen. Spiellogik und UI nicht kaputt machen; alles hinter Feature-Flags, bis es getestet ist.
> Antworten an mich: Deutsch, knapp.

---

## 0. Ziel und Messlatte

Ich spiele, das Gerät liegt 2–3 m entfernt. Ich sage **„Wurf sechzig“**, und es muss stimmen – auch wenn nebenbei geredet wird, Musik läuft, Darts ins Board knallen und die App selbst gerade spricht.

**Messbare Ziele (werden automatisch getestet, siehe §9):**
| Metrik | Ziel |
|---|---|
| Richtige Erkennung gültiger Befehle aus 2,5 m, normale Lautstärke | ≥ 97 % |
| Falsch-Annahmen bei 30 min Gespräch/TV ohne Befehle | ≤ 1 |
| Zeit von Sprechende bis Ansage | ≤ 700 ms |
| Verwechslung 16↔60, 17↔70, 14↔40, 2↔3 nach Bestätigungslogik | 0 unbemerkt |

---

## 1. Grundlagen: Was das Mikrofon hört und wie die Kette funktioniert

Damit du (und ich) die Entscheidungen verstehen:

- Das Mikro liefert ein **Rohsignal** (Browser meist 44,1/48 kHz). Darin steckt alles: meine Stimme (aus 2,5 m schon deutlich leiser und mit Raumhall), Dart-Einschläge (kurze, laute Transienten mit viel Tiefen), Gerede, Musik, Lüfter, und die eigene Sprachausgabe der App.
- Der Browser kann vorverarbeiten: `echoCancellation` (entfernt eigene Wiedergabe), `noiseSuppression`, `autoGainControl`, und – je nach Plattform, v. a. Safari – `voiceIsolation` (Stimmisolierung des Betriebssystems).
- Die Erkennung (Vosk/Kaldi) arbeitet mit **16 kHz mono**. Sie zerlegt Audio in Lautmerkmale, berechnet Wahrscheinlichkeiten für Wörter und sucht die wahrscheinlichste Wortfolge. Mit **Grammatik** darf sie nur aus einer festen Liste wählen → viel genauer, aber sie „presst“ auch Geräusche in die Liste, wenn man ihr kein Ventil (`[unk]`) gibt.
- Jede Stufe hat einen Zweck: **Lautes besser machen (Gain), Unwichtiges wegwerfen (Filter, VAD), Erkennung einschränken (Grammatik), Ergebnisse prüfen (Konfidenz, Plausibilität), Fehler abfangen (Bestätigung, Undo), aus Fehlern lernen (Aliase).**

---

## 2. Zielarchitektur: 9 Filterstufen

```
Mikrofon
 │ [S1] Capture-Constraints (echoCancellation, voiceIsolation, NS/AGC wählbar)
 ▼
 │ [S2] DSP-Kette im AudioWorklet: Hochpass → Gain → Kompressor/Limiter → (optional) Rauschunterdrückung
 ▼
 │ [S3] Transienten-Detektor (Dart-Einschläge erkennen & ausblenden, optional zählen)
 ▼
 │ [S4] Voice Activity Detection (Silero) + Pre-Roll-Puffer → nur Sprachsegmente weiter
 ▼
 │ [S5] Vosk mit Grammatik + [unk], Wort-Konfidenzen, Partial-Results
 ▼
 │ [S6] Normalisierung + Alias-Mapping + Zahlen-Parser
 ▼
 │ [S7] Zustandsautomat (Trigger → Zahl → Kandidat), Zeitfenster, Entprellung
 ▼
 │ [S8] Plausibilität gegen Spielstand (unmögliche Scores, Verwechslungspaare)
 ▼
 │ [S9] Bestätigung (TTS + Visual) mit Undo-Fenster → Commit ins Event-Log → Lern-Log
```

Jede Stufe einzeln messbar, abschaltbar und in der Debug-Seite sichtbar.

---

## 3. Stufen im Detail

### S1 – Capture
```ts
getUserMedia({ audio: {
  channelCount: 1,
  echoCancellation: true,          // immer an: verhindert, dass die App sich selbst hört
  noiseSuppression: cfg.osNS,      // Standard: AN; im Kalibrier-A/B testen
  autoGainControl: cfg.osAGC,      // Standard: AUS, wir regeln selbst (AGC pumpt bei Einschlägen)
  voiceIsolation: cfg.voiceIso,    // wo unterstützt (v. a. Safari/Apple), sonst ignoriert
  deviceId: cfg.deviceId           // Mikrofonauswahl
}})
```
- `getSettings()` nach dem Start auslesen und anzeigen, was **tatsächlich** aktiv ist (Browser ignorieren Constraints still).
- **Mikrofonauswahl** im UI (`enumerateDevices`): eingebautes Mikro, Bluetooth-Headset, AirPods, Ansteckmikro. Hinweis im UI: Ein Mikro nah am Mund schlägt jede Software-Filterung.
- iOS: `navigator.audioSession.type = 'play-and-record'` wenn vorhanden.

### S2 – DSP-Kette (eigenes AudioWorklet, kein ScriptProcessor)
1. **Hochpass ~120 Hz** (BiquadFilter): entfernt Brummen, Trittschall, den tiefen Anteil der Dart-Einschläge. Stimme bleibt unberührt.
2. **Gain 0 bis +30 dB** („Mikro extra laut“), per Kalibrierung gesetzt.
3. **Kompressor + Limiter**: hebt leise Sprache an, verhindert Übersteuern durch Einschläge (Clipping zerstört Erkennung).
4. **Optionale Rauschunterdrückung**: `@sapphi-red/web-noise-suppressor` bietet fertige Worklet-Nodes (NoiseGate, RNNoise, Speex) und hat eine Vite-Anleitung. **Wichtig:** Denoiser können die Erkennung auch *verschlechtern* (Artefakte). Deshalb nur nach A/B-Messung mit dem Testkorpus aktivieren; Standard = aus, Profil „laute Kneipe“ = RNNoise an.
5. **Resampling auf 16 kHz** im Worklet (sauberer Tiefpass vor dem Downsampling, sonst Aliasing).

### S3 – Transienten-Detektor (Dart-Einschläge)
- Einschlag = sehr schneller Pegelanstieg (< 5 ms), kurze Dauer, breitbandig. Erkennen über Energie-Differenz + spektralen Flux.
- **Funktion A (Standard):** Die 80–150 ms um einen Einschlag werden für VAD/Erkennung als „kein Sprechen“ markiert → keine Fehltrigger durch Treffer.
- **Funktion B (experimentell, Flag):** Einschläge zählen. Nach 3 Einschlägen weiß die App, dass die Aufnahme fertig ist → sie erwartet jetzt eine Zahl, Direkt-Modus wird für 6 s scharf geschaltet, kurzer Hinweiston. Außerhalb dieses Fensters gilt der Trigger-Modus. So wird Gerede zwischen den Würfen noch besser ignoriert.

### S4 – Voice Activity Detection
- **Silero VAD** im Browser über `@ricky0123/vad-web` (läuft mit ONNX Runtime Web).
- Nur Segmente, die als Sprache erkannt werden, gehen an Vosk. Spart Rechenzeit (Akku) und verhindert, dass Grammatik Geräusche in Zahlen verwandelt.
- **Pre-Roll 300–400 ms**: Ringpuffer, damit der Wortanfang („W“ von „Wurf“) nicht abgeschnitten wird.
- Segment-Grenzen: min. 250 ms, max. 5 s, Nachlauf 300 ms. Schwellwerte (positive/negative speech threshold) einstellbar und durch Kalibrierung gesetzt.
- Fallback ohne VAD, falls ONNX auf einem Gerät nicht läuft: Energie-VAD mit adaptivem Rauschboden.

### S5 – Vosk-Erkennung
- `@lichess-org/vosk-browser` (gepflegter Fork), Modell `vosk-model-small-de-0.15`. Nur die *small*-Modelle erlauben Grammatik/Vokabular zur Laufzeit.
- `new KaldiRecognizer(16000, JSON.stringify(grammar))`, `setWords(true)` für Wort-Konfidenzen.
- **Partial Results nutzen** (wie Lichess bei Sprachzügen): Sobald ein Partial bereits eindeutig „Trigger + vollständige Zahl“ ergibt und die VAD Sprechende meldet, sofort verarbeiten statt auf das Final zu warten → spürbar schneller. Final-Result bestätigt oder korrigiert.
- **Ein Recognizer pro Modell** (die Bibliothek entfernt beim Anlegen bestehende Recognizer). Kontextwechsel (z. B. Ja/Nein-Fragen, Spielerwahl) daher über **eine** Gesamtgrammatik + Zustandsautomat lösen, nicht über mehrere Recognizer.
- Englisch als zweite Sprache (Modell `vosk-model-small-en-us-0.15`) wählbar, mit Darts-Slang: „one hundred and eighty“, „ton forty“, „no score“, „bust“.

### S6 – Lexikon, Normalisierung, Aliase
**Grammatik und Parser kommen aus einer einzigen Quelle** (`voice/lexicon.de.ts`), daraus generiert:
- Grammatik-Liste für Vosk
- Parser-Tabellen
- Hilfe-Seite „Was kann ich sagen?“

**Vokabular-Prüfung (Pflicht):** Vosk kann nur Wörter erkennen, die im Modell-Lexikon stehen. Lies das Vokabular des Modells aus (Modelldateien bzw. die Vokabelliste, die z. B. das Rhasspy-Projekt für `vosk-model-small-de-0.15` veröffentlicht) und entscheide **datenbasiert**, ob Zahlen als Kompositum („hunderteinundvierzig“) oder in Teilen („hundert“, „einundvierzig“) in die Grammatik müssen. Wörter, die fehlen, werden im Build als Fehler gemeldet. Das gilt auch für ein **selbst gewähltes Triggerwort** (Eingabe nur aus geprüfter Liste oder mit Live-Prüfung).

**Aliase für typische Fehlhörer** (Vorbild: das Open-Source-Projekt `lbormann/darts-voice`, das genau so Ersatzwörter pro Zahl pflegt, z. B. „sehen“→zehn, „frei“→zwei, „vorbei“→null):
- Start-Aliase: „zwo“ → zwei (deutlicher als „zwei“, ich soll es auch so sagen können), „Bulle/Bull“ → 25/50 je Kontext, „nix/nichts/vorbei/daneben“ → 0, „überworfen/bust/drüber“ → Bust.
- Aliase pro Nutzer erweiterbar und **automatisch gelernt** (S9).

**Zahlen-Parser:** versteht alle Schreib- und Sprechweisen 0–180 („hundert vierzig“, „einhundertvierzig“, „hundertundvierzig“), wertet „sechs null“ **nicht** als 60, ignoriert Füllwörter („äh“, „also“). Property-Based-Tests (fast-check) über alle Werte.

### S7 – Zustandsautomat
```
IDLE ──Trigger erkannt──► ARMED (4 s Fenster, dezenter Ton + Ring leuchtet)
ARMED ──Zahl/Befehl──► CANDIDATE
ARMED ──Timeout──► IDLE
IDLE ──"Triggerwort Zahl" in einem Satz──► CANDIDATE
CANDIDATE ──S8 ok──► CONFIRMING (Ansage + 3 s Undo-Fenster) ──► COMMITTED ──► IDLE
CANDIDATE ──S8 abgelehnt──► IDLE (Fehlerton + kurze Ansage)
CONFIRMING ──"nein/falsch/zurück"──► IDLE (verworfen)
SPEAKING (TTS läuft): Audio NICHT an Vosk, +300 ms Nachlauf; nur "stopp/nein" per Energie-Barge-in erlaubt
```
- **Zweistufiger Trigger** erlaubt „Wurf … (Pause) … sechzig“.
- **Entprellung:** gleicher Befehl innerhalb von 1,5 s wird ignoriert; nach Commit 800 ms Sperre.
- **Trigger-Konfidenz strenger** als Zahlen-Konfidenz (Trigger ist das Tor gegen Gerede).

### S8 – Plausibilität gegen den Spielstand
- Unmögliche 3-Dart-Scores (163, 166, 169, 172, 173, 175, 176, 178, 179, > 180) → ablehnen.
- **Verwechslungspaare** 16/60, 17/70, 14/40, 18/80, 19/90, 13/30, 15/50, 2/3, 12/20 haben eine eigene Regel: Wenn die Konfidenz des Zahlworts unter einer zweiten, höheren Schwelle liegt, sagt die App explizit nach: „Sechzig – nicht sechzehn?“ und wartet auf „ja“/„nein“ (ohne Trigger). Bei hoher Konfidenz normale Bestätigung.
- **Kontext-Priorisierung:** Ist der Rest z. B. 60 und erkannt wurde „sechzehn“ mit knapper Konfidenz, Nachfrage auslösen (Checkout-Kontext macht 60 deutlich wahrscheinlicher).
- Checkout-Plausibilität: Rest ≤ 170 und kein Bogey (159, 162, 163, 165, 166, 168, 169), sonst kann es kein Checkout sein.

### S9 – Bestätigung, Undo, Lernen
- Ansage „Sechzig. Rest vierhunderteinundvierzig.“ + Vollflächen-Farbblitz (aus 3 m sichtbar).
- Jede Erkennung landet im **Lern-Log** (lokal, IndexedDB): Rohtext, Partials, Wort-Konfidenzen, akzeptiert/verworfen/korrigiert, Pegel, Profil.
- **Auto-Alias-Vorschläge:** Wenn ein Rohwort mehrfach zu einer per Touch/Sprache korrigierten Zahl gehört, schlägt die App vor: „‚sehen‘ immer als zehn werten?“ (ein Tap).
- **Adaptive Schwellen:** Konfidenz-Schwellen pro Nutzer aus dem Log nachjustieren (Ziel: Falsch-Annahmen minimieren, Ablehnungen von Richtigem < 3 %).

---

## 4. Kalibrierung („Sprachtraining“, 60 Sekunden)

Geführter Ablauf beim ersten Start und jederzeit in den Einstellungen, **aus Wurfposition**:
1. **Stille/Raum (10 s):** Rauschboden messen → Gate/VAD-Schwellen.
2. **Pegel:** „Sag laut: Wurf hundertachtzig“ → Gain so setzen, dass Sprachspitzen bei ca. −12 dBFS liegen, ohne Clipping.
3. **Einschläge:** „Wirf drei Darts“ → Transienten-Detektor einmessen.
4. **Testsätze (10 Stück):** kritische Zahlen (16, 60, 17, 70, 3, 2, 140, 100, 45, 26) → Trefferquote anzeigen, Aliase/Schwellen anpassen.
5. **A/B automatisch:** Denoiser an/aus, OS-NoiseSuppression an/aus kurz gegeneinander testen → beste Kombi speichern.
6. **Trigger-Robustheit (optional, 2 min):** Normal weiterreden/TV laufen lassen → Falsch-Trigger zählen. Bei > 0: stärkeres Triggerwort vorschlagen (2–3 Silben, markante Laute wirken besser als kurze Wörter).

Ergebnis als **Profil** speichern (z. B. „Wohnzimmer“, „Vereinsheim“, „Mit Headset“), schnell umschaltbar.

---

## 5. Debug- & Diagnose-Ansicht (`/debug/voice`)

- Live: Pegel vor/nach jeder DSP-Stufe, Gain-Reduktion des Kompressors, VAD-Wahrscheinlichkeit, Einschlag-Marker, Automatenzustand.
- Letzte 50 Erkennungen: Rohtext, Partials, Wort-Konfidenzen, Entscheidung + Grund („abgelehnt: Trigger-Konfidenz 0,41 < 0,6“).
- Tatsächlich aktive Constraints (`getSettings()`), Sample-Rate, Engine, Modellversion, Latenz pro Stufe.
- **Aufnahme-Knopf:** letzte 10 s als WAV exportieren (für den Testkorpus, §9).

---

## 6. Plattformdetails (Mac + Handy)

- Gleiches Verhalten in Chrome/Safari macOS, Safari iOS (Home-Screen-App), Chrome Android. Feature-Detection statt Browser-Sniffing.
- iOS: AudioContext nur nach Nutzergeste; bei Unterbrechung (Anruf, Sperre, App-Wechsel) Pipeline sauber neu aufbauen und Zustand anzeigen. Wake Lock während des Spiels.
- Rechenlast im Blick: VAD + Vosk + Worklets auf einem älteren iPhone messen; wenn zu schwer, VAD auf Energie-Fallback, Denoiser aus.
- Modell + VAD-Modell + WASM offline cachen (Service Worker), `navigator.storage.persist()`.

## 7. Plan B: native Erkennung (nur wenn die Web-Lösung die Ziele aus §0 nicht erreicht)

Hinter dem bestehenden Engine-Interface eine zweite Implementierung über **Capacitor**: Apple-Spracherkennung on-device mit Kontext-Vokabular (Zahlwörter + Befehle) bzw. Android-SpeechRecognizer offline. Gleiche Stufen S6–S9 dahinter. Erst nach Rücksprache mit mir.

---

## 8. Ideen, die du bewerten sollst (nicht blind bauen)

- **Kommerzielles Wake-Word** (z. B. Picovoice Porcupine im Browser) als Trigger statt Vosk-Trigger: oft sehr robust, braucht aber einen Account/Key und hat Lizenzgrenzen → Aufwand/Nutzen bewerten.
- **Sprecher-Verifikation** (nur meine Stimme zählt): bewerten, ob leichtgewichtig im Browser machbar.
- **Einzeldart-Ansage** („Triple zwanzig, Doppel zehn“) im gleichen Lexikon.

---

## 9. Testkorpus & automatische Evaluation (das macht es wirklich gut)

- Ordner `test/voice-corpus/`:
  - `commands/` – WAVs mit gültigen Befehlen, Dateiname = erwartetes Ergebnis (`wurf_60__01.wav`)
  - `negatives/` – Gespräche, TV, Musik, Einschläge, App-eigene Ansagen (erwartet: nichts)
  - `confusables/` – 16/60, 17/70, 2/3 usw.
- Erzeuge zuerst einen **synthetischen Startkorpus** (TTS-Stimmen + künstlich beigemischter Raumhall, Pegelabsenkung für 2,5 m, Einschlag-Geräusche, Hintergrundgeräusch), damit Tests sofort laufen. Erklär mir dann, wie ich echte Aufnahmen über die Debug-Ansicht hinzufüge – echte Aufnahmen haben Vorrang.
- **Eval-Runner im echten Browser** (Playwright, headless Chromium + WebKit): lädt die WAVs, schickt sie durch **exakt dieselbe Pipeline** (S2–S9, Mikro durch Dateiquelle ersetzt) und berechnet:
  - Accuracy, Falsch-Annahmen pro Stunde Negativ-Audio, Verwechslungsmatrix, Latenz-Perzentile.
- **Parameter-Sweep:** Gain, VAD-Schwellen, Konfidenz-Schwellen, Denoiser an/aus automatisch durchprobieren → beste Defaults als Report (`reports/voice-eval.md`) + Übernahme in die Standardkonfiguration.
- Eval läuft per `npm run eval:voice` und in CI; Verschlechterung gegenüber dem letzten Stand = Test rot.
- Unit-Tests: Parser (alle 0–180, Property-Based), Automat (alle Übergänge, Timeouts mit Fake-Timern), Plausibilität, Alias-Lernen.

---

## 10. Phasen

1. **Analyse & Ist/Soll-Bericht** (keine Änderungen).
2. **Testkorpus + Eval-Runner** zuerst – damit jede weitere Änderung messbar ist. Baseline des aktuellen Systems messen.
3. **S1–S2** (Capture, DSP, Gain, Kompressor, Resampling) → Eval.
4. **S4** VAD + Pre-Roll → Eval.
5. **S5–S6** Grammatik aus Lexikon, Vokabular-Prüfung, Partials, Aliase → Eval.
6. **S7–S8** Automat + Plausibilität + Verwechslungspaar-Nachfrage → Eval.
7. **S9** Lern-Log, Auto-Aliase, adaptive Schwellen.
8. **S3** Einschlag-Erkennung (A Standard, B experimentell) → Eval.
9. **Kalibrierung + Profile + Debug-Ansicht** fertigstellen.
10. **Parameter-Sweep**, Defaults festlegen, Report an mich mit Vorher/Nachher-Zahlen.

Nach jeder Phase: Eval-Zahlen vorher/nachher, was ich auf dem Handy testen soll.

**Definition of Done:** Die Ziele aus §0 sind im Eval-Report erreicht, und ich spiele ein komplettes 501-Match am iPhone und am Mac nur per Stimme, mit laufendem Gespräch im Raum, ohne eine einzige unbemerkte Falscheingabe.
