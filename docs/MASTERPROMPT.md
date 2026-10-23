# MASTERPROMPT – „OCHE“: Sprachgesteuerter Darts-Scorer (Mac + Handy)

> Du bist Claude Code. Baue in diesem Ordner eine produktionsreife App nach dieser Spezifikation.
> Arbeite in Phasen, starte im **Plan Mode**, zeig mir den Plan, dann setz Phase für Phase um.
> Nach jeder Phase: Tests laufen lassen, kurz berichten, dann weiter. Frag nur, wenn eine Entscheidung wirklich offen ist.

---

## 0. Die Idee in einem Satz

Ich spiele Steeldarts und will **nie ans Handy müssen**: Das Mikro ist dauerhaft an, ich sage z. B. **„Wurf sechzig“**, die App zieht 60 ab, sagt mir laut den Rest an, und ich werfe weiter. Ein Gerät liegt 2–3 m entfernt auf dem Tisch oder hängt neben dem Board. Es muss auf meinem **MacBook und meinem Handy identisch** funktionieren.

---

## 1. Skills & Setup (vor dem ersten Code)

Diese Skills installieren und **aktiv nutzen**:

1. **frontend-design** (offizieller Anthropic-Skill, legt vor dem UI-Code eine echte Designrichtung fest):
   ```
   /plugin install frontend-design@claude-plugins-official
   ```
   Falls nicht gefunden:
   ```
   /plugin marketplace add anthropics/claude-code
   /plugin install frontend-design@claude-code-plugins
   ```
2. **webapp-testing** (Playwright-Toolkit von Anthropic, für Screenshots, UI-Checks und End-to-End-Tests):
   ```
   /plugin marketplace add anthropics/skills
   /plugin install example-skills@anthropic-agent-skills
   ```

Lege außerdem eine `CLAUDE.md` an mit: Projektziel, Architektur, Befehlen (dev/test/build/deploy), Konventionen. Halte sie aktuell.

---

## 2. Plattform-Entscheidung (begründet, nicht ändern ohne Rückfrage)

**Progressive Web App (PWA)** – eine Codebasis, läuft im Browser auf dem Mac und als „Zum Home-Bildschirm“-App auf iPhone/Android. Kein App Store, kein Xcode-Signing, keine 7-Tage-Zertifikate.

- **Stack:** Vite + React + TypeScript (strict), Zustand (State), Dexie/IndexedDB (Persistenz), Vitest (Unit), Playwright (E2E), `vite-plugin-pwa` (Service Worker + Manifest).
- **Deployment:** GitHub Pages oder Vercel (kostenlos). **HTTPS ist Pflicht**, sonst gibt es keinen Mikrofonzugriff auf dem Handy.
- **Lokal testen auf dem Handy:** `vite --host` + HTTPS (z. B. `@vitejs/plugin-basic-ssl` oder `mkcert`), damit ich vom Handy im WLAN testen kann.
- **Plan B (nur falls die PWA auf iOS scheitert):** Dieselbe App mit **Capacitor** als native iOS/Android-App verpacken. Architektur so bauen, dass die Spracherkennung hinter einem Interface liegt und austauschbar ist.

---

## 3. Spracherkennung – das Herzstück

### 3.1 Warum NICHT nur die Web Speech API

`SpeechRecognition` im Browser bricht nach Pausen ab, braucht Neustarts (auf Android mit Piepton), läuft teils über Cloud, und – entscheidend – man kann das Mikrofonsignal **nicht verstärken**, weil die API ihr eigenes Mikro öffnet.

### 3.2 Primäre Engine: Vosk offline im Browser (WASM) mit Grammatik

- Paket: **`@lichess-org/vosk-browser`** (gepflegter Fork von `vosk-browser`; Lichess nutzt Vosk genau so für Sprach-Schachzüge). Läuft in einem Web Worker.
- Modell: **`vosk-model-small-de-0.15`** (~45 MB, Deutsch). Nur die _small_-Modelle unterstützen eine Grammatik zur Laufzeit.
- **Grammatik-Modus:** Der `KaldiRecognizer(16000, grammar)` bekommt eine JSON-Liste **aller erlaubten Phrasen** (Triggerwort + Zahlen 0–180 + Befehle + `"[unk]"`). Dadurch erkennt er praktisch nur Darts-Sprache → extrem hohe Trefferquote, Gerede am Tisch landet in `[unk]`.
- Prüfe beim Start, dass jedes Grammatik-Wort im Modell-Vokabular existiert (`words.txt` bzw. Vosk-Warnungen) – sonst Warnung im UI. Das gilt besonders für ein **selbst gewähltes Triggerwort**.
- `setWords(true)` → Konfidenz pro Wort nutzen; Ergebnisse unter einem einstellbaren Schwellwert verwerfen und per Ton signalisieren („nicht verstanden“).
- Modell per Service Worker cachen + `navigator.storage.persist()` anfragen → funktioniert danach **offline**.

### 3.3 Fallback-Engine: Web Speech API

Wenn das Modell nicht lädt oder das Gerät zu schwach ist: `webkitSpeechRecognition`, `continuous`, `lang='de-DE'`, Auto-Restart bei `onend`. Gleicher Parser dahinter. Im UI anzeigen, welche Engine aktiv ist.

### 3.4 Audio-Pipeline „Mikro extra laut“

```
getUserMedia({ audio: { echoCancellation: true, noiseSuppression: <einstellbar>, autoGainControl: <einstellbar> } })
 → GainNode (Verstärkung 0 bis +30 dB, Slider)
 → DynamicsCompressor (verhindert Übersteuern bei lauten Treffern)
 → Noise Gate (einstellbarer Schwellwert, filtert Dart-Einschläge/Hintergrund)
 → AudioWorklet (Downsampling auf 16 kHz Float32, KEIN ScriptProcessor)
 → Vosk-Worker
```

- **Live-Pegelanzeige** + „Testmodus“: Ich sage etwas aus 3 m Entfernung, sehe Pegel und erkannten Text, und ein **Auto-Kalibrieren**-Button stellt Gain und Gate passend ein (10 s Raumgeräusch messen, dann einen Testsatz).
- Ehrlicher Hinweis im UI: Die System-Mikrolautstärke kann eine Web-App nicht ändern – die Verstärkung passiert in der App.

### 3.5 Dauer-Mikro & Robustheit

- Ein großer **Start-Button** (nötig wegen Autoplay/Audio-Policy), danach bleibt alles an.
- **Screen Wake Lock** (`navigator.wakeLock`) während eines Spiels; nach `visibilitychange` neu anfordern. Auf iOS geht das in Home-Screen-Apps ab iOS 18.4.
- Unterbrechungen (Anruf, App im Hintergrund, Bildschirmsperre) erkennen → beim Zurückkommen AudioContext + Recognizer automatisch fortsetzen, Status anzeigen.
- **Kein Selbst-Triggern:** Während die App selbst spricht (TTS), Erkennung pausieren bzw. Audio nicht an den Recognizer füttern; danach 300 ms Puffer.
- iOS: `navigator.audioSession.type = 'play-and-record'` setzen, wenn verfügbar (sonst wird die Sprachausgabe bei offenem Mikro leise). Auf echtem iPhone verifizieren.

---

## 4. Sprachbefehle (Protokoll)

Standard-Triggerwort: **„Wurf“** (in den Einstellungen änderbar; nur Wörter aus dem Modellvokabular zulassen, Vorschlagsliste z. B. „Wurf“, „Treffer“, „Punkte“, „Darts“ – jeweils prüfen).

| Ich sage                                                         | Wirkung                                          |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| „Wurf sechzig“ / „Wurf hundertachtzig“                           | Aufnahme 60 / 180 für aktuellen Spieler          |
| „Wurf null“ / „Wurf nichts“                                      | 0 Punkte                                         |
| „Überworfen“ / „Bust“                                            | Bust, Aufnahme = 0, Rest bleibt                  |
| „Zurück“ / „Rückgängig“                                          | Letzte Aufnahme rückgängig                       |
| „Korrektur fünfundvierzig“                                       | Letzte Aufnahme durch 45 ersetzen                |
| „Nein“ / „Falsch“ (innerhalb des Bestätigungsfensters)           | Gerade erkannte Eingabe verwerfen                |
| „Rest“                                                           | App sagt meinen Restwert und Checkout-Weg an     |
| „Check mit zwei“ / „Aus mit drei“                                | Checkout mit X Darts (für Statistik)             |
| „Neues Leg“, „Pause“, „Weiter“, „Mikro aus“                      | Steuerung                                        |
| Optional Einzeldarts: „Triple zwanzig, Doppel zehn, Single fünf“ | Summe wird gebildet, Checkout auf Doppel prüfbar |

**Modi (einstellbar):**

- _Trigger-Modus_ (Standard, für Spiele mit Leuten): nur „Triggerwort + Zahl“ zählt.
- _Direkt-Modus_ (Solo-Training): nur die Zahl reicht.

**Zahlen-Parser (deutsch):** Muss Komposita und getrennte Schreibweisen verstehen: „hunderteinundvierzig“, „hundert einundvierzig“, „einhundertvierzig“, „ein hundert vierzig“, „sechzig“, „sechs null“ (nicht als 60 werten!). Grammatik und Parser aus **einer** Quelle generieren (`numbers.de.ts`). Umfangreiche Unit-Tests mit allen Werten 0–180.

**Validierung:**

- Unmögliche Aufnahmen ablehnen: **163, 166, 169, 172, 173, 175, 176, 178, 179** und > 180 → „Nicht möglich“ ansagen.
- Double-Out: Aufnahme > Rest, oder Rest bleibt 1 → automatisch Bust. Rest exakt 0 → Checkout, dann (einstellbar) per Sprache nachfragen „Mit wie vielen Darts?“ und optional „Darts auf Doppel?“.
- Bogey-Reste (159, 162, 163, 165, 166, 168, 169) als nicht in 3 Darts checkbar kennen.

**Bestätigung:** Nach jeder Eingabe sagt die Stimme z. B. „Sechzig. Rest vierhunderteinundvierzig.“ + großer Farbblitz. 3 s Fenster für „Nein“. Danach endgültig (aber per „Zurück“ weiter korrigierbar).

---

## 5. Spiellogik

- **X01:** 101, 301, 501, 701, 901, 1001 + frei einstellbar. In: Straight/Double/Master. Out: Straight/Double/Master.
- **Spieler:** 1–8, Namen frei, Reihenfolge, „Bull-Out“ für Startspieler oder abwechselnd. Schnellstart: **1 gegen 1, 501, Double-Out, First to 3 Legs** mit einem Tap.
- **Format:** Legs und Sets, „First to“ oder „Best of“.
- **Gegner-Bot** (optional, Phase 6): Zielaverage einstellbar, simulierte Würfe.
- **Training:** Around the Clock, Checkout-Training (zufällige Reste 2–170), 121-Challenge.
- **Architektur: Event-Sourcing.** Jede Aufnahme ist ein Event, der Spielstand wird daraus berechnet → Undo/Korrektur trivial, keine Inkonsistenzen. Engine als **reine Funktionen ohne UI-Abhängigkeit**, 100 % testbar.
- **Checkout-Rechner:** Für alle Reste 2–170 bevorzugte Wege (Standard-Profi-Wege, z. B. 121: T20 T11 D14; 170: T20 T20 Bull). Wird angezeigt und auf Wunsch angesagt („Du brauchst hunderteinundzwanzig“).
- **Statistik:** 3-Dart-Average, First-9-Average, Checkout-Quote, Höchstes Finish, 180er / 140+ / 100+, Darts pro Leg, Verlauf pro Spieler über Zeit (Diagramme). Alles lokal in IndexedDB, Export/Import als JSON (damit ich Daten zwischen Mac und Handy übertragen kann).

---

## 6. Stimme / Caller

- **SpeechSynthesis** mit Auswahl aller verfügbaren System-Stimmen (Deutsch und Englisch), Geschwindigkeit, Tonhöhe, Lautstärke.
- **Caller-Stile:**
  - _Nüchtern:_ „Sechzig. Rest vierhunderteinundvierzig.“
  - _Arena:_ Englischer Ansager-Stil mit Betonung, z. B. „One hundred and eighty!“, „Game shot, and the first leg!“, „You require one hundred and twenty-one.“ – eigene Formulierungen, keine Imitation realer Personen.
- Besondere Momente (180, Ton+, Highfinish ≥ 100, Matchgewinn) bekommen eigene Ansagen + kurze Soundeffekte (selbst erzeugt per Web Audio, keine fremden Samples).
- Ansage, wer dran ist: „Max, du bist dran. Du brauchst zweiundreißig.“
- Alles einzeln abschaltbar.

---

## 7. Design – nutze den frontend-design-Skill

Lass den Skill eine eigenständige Richtung festlegen. Meine Vorgaben als Briefing:

**Kernproblem:** Das Gerät liegt **2–3 m entfernt**. Der aktuelle Rest muss vom Abwurf (2,37 m) aus **ohne Brille lesbar** sein.

- **Spielansicht:** Riesige Restzahl des aktiven Spielers (dominiert den Bildschirm, tabellarische Ziffern), darunter klein Gegner-Rest, Leg-/Set-Stand, Checkout-Weg, letzte Aufnahme. Querformat und Hochformat sauber gelöst.
- **Mikro-Status immer sichtbar und aus der Ferne erkennbar:** ruhiges Pulsieren = hört zu; Ausschlag = Sprache erkannt; grüner Vollflächenblitz = angenommen; roter Blitz = abgelehnt/Bust; grau = pausiert.
- **Richtungsvorschlag „Oche Night“:** dunkel, matt, Inspiration Dartboard: Sisal-Beige, tiefes Board-Schwarz, Rot und Grün der Doppel-/Triple-Ringe als Signalfarben, kondensierte Display-Schrift mit Charakter. Der Skill darf eine bessere Richtung wählen, aber nicht generisch (kein Standard-Lila-Verlauf, keine Systemschrift-Optik).
- **Touch-Fallback** immer vorhanden: großes Zahlenpad (Gesamtaufnahme) und optional Board-Pad für Einzeldarts, Schnelltasten für häufige Werte (26, 41, 45, 60, 81, 85, 100, 140, 180).
- **Setup-Screen:** in 2 Taps zum Spiel. Einstellungen gruppiert: Spiel · Spieler · Sprache & Mikro · Stimme · Darstellung.
- **Onboarding (einmalig):** Mikro erlauben → Kalibrieren aus Abwurfdistanz → Testbefehl → los. Auf iOS Anleitung „Teilen → Zum Home-Bildschirm“.
- Barrierefrei: hohe Kontraste, `prefers-reduced-motion` respektieren, Dark Mode Standard, optional Hell für helle Räume.
- App-Icon und Manifest-Farben passend zur Richtung.

---

## 8. Mac und Handy – gleiches Verhalten

- Eine Codebasis, responsive (Handy hoch/quer, Mac-Fenster, Tablet).
- Getestet in: Chrome + Safari auf macOS, Safari auf iPhone (als Home-Screen-App), Chrome auf Android.
- Feature-Detection statt Browser-Sniffing; fehlende Features (Wake Lock, audioSession) sauber degradieren.
- **Diagnose-Seite** (`/debug`): aktive Engine, Sample-Rate, Pegel, letzte 20 Rohergebnisse mit Konfidenz, Wake-Lock-Status, Speicherstatus. Damit ich Probleme am Handy selbst sehe.
- Optional, Phase 7: **Zwei-Geräte-Modus** – Mac als großes Scoreboard, Handy als Mikro neben dem Board (WebRTC per QR-Code-Kopplung, kein eigener Server nötig außer Signalisierung). Nur angehen, wenn alles andere stabil ist.

---

## 9. Qualität & Tests

- **Unit (Vitest):** Scoring-Engine (Bust, Double-Out, Undo, Legs/Sets), Checkout-Tabelle, Zahlen-Parser (alle 0–180 in allen Schreibweisen), Befehlserkennung inkl. Trigger-/Direkt-Modus.
- **E2E (Playwright, webapp-testing-Skill):** komplettes 501-Leg per Touch; Screenshots aller Screens auf Handy- und Desktop-Viewport prüfen.
- **Sprach-E2E:** Chrome mit `--use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=<wav>` starten und aufgenommene Testsätze (WAV) durch die echte Pipeline schicken. Lege `test/audio/` mit Beispieldateien an und erkläre mir, wie ich eigene Aufnahmen hinzufüge.
- Lighthouse-PWA-Check grün, App startet offline.
- Keine Fehler in der Konsole, TypeScript strict ohne `any`.

---

## 10. Phasenplan

1. **Setup:** Projekt, Skills, CLAUDE.md, Lint/Format, Tests lauffähig.
2. **Engine:** X01-Logik, Event-Sourcing, Checkout-Tabelle, Statistik – vollständig getestet.
3. **UI mit Touch-Eingabe:** Designrichtung via frontend-design-Skill festlegen, Setup-, Spiel-, Statistik-, Einstellungs-Screens. Screenshots prüfen.
4. **Sprache:** Audio-Pipeline mit Gain/Gate/Kalibrierung, Vosk + Grammatik, Parser, Bestätigung/Undo, Fallback-Engine, Debug-Seite.
5. **Caller:** TTS, Stile, Spezialansagen, Echo-Schutz.
6. **PWA & Deploy:** Manifest, Icons, Offline-Cache inkl. Modell, Wake Lock, HTTPS-Deploy. Gib mir die URL und eine 5-Schritte-Anleitung fürs Installieren am iPhone und Android.
7. **Extras:** Bot-Gegner, Trainingsmodi, Zwei-Geräte-Modus.

**Definition of Done:** Ich kann am Handy ein komplettes 1-gegen-1-Match (501, Double-Out, First to 3) aus 2,5 m Entfernung **nur per Stimme** spielen, inklusive einer Korrektur und eines Busts, ohne das Gerät anzufassen – und auf dem Mac genauso.

---

## 11. Arbeitsweise

- Erst Plan, dann Code. Kleine, saubere Commits pro Teilschritt (Git initialisieren).
- Nach jeder Phase: was fertig ist, was ich testen soll, bekannte Grenzen.
- Wenn eine Bibliothek/API sich anders verhält als hier beschrieben: aktuelle Doku prüfen, Lösung vorschlagen, nicht stillschweigend abweichen.
- Antworten an mich auf Deutsch, knapp.
