# Oche-Klang-Paket erzeugen

Eigene Ansagerstimme mit [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT-Lizenz).
Die Clips sind synthetisch; es wird keine reale Person imitiert. Chatterbox bettet ein unhörbares Wasserzeichen ein.

## Einrichten (einmalig, ca. 5 GB in `.cache/`)

```bash
uv venv --python 3.11 .cache/tts-venv
VIRTUAL_ENV=.cache/tts-venv uv pip install chatterbox-tts==0.1.7 "setuptools<81" vosk
npm run model                     # deutsches Vosk-Modell (für die Prüfung)
curl -fLO --output-dir .cache https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip -q -d .cache .cache/vosk-model-small-en-us-0.15.zip
```

## Erzeugen

```bash
npx tsx scripts/voicepack/export-spec.ts                  # Clip-Liste aus src/caller/voicepack.ts
.cache/tts-venv/bin/python scripts/voicepack/generate.py de
.cache/tts-venv/bin/python scripts/voicepack/generate.py en
```

- Intensität je Clip (`calm` … `max`) steuert Emotionsstärke (`exaggeration`) und Ziel-Lautheit (−20 … −13 LUFS).
- Jeder Clip wird von Vosk zurückgehört; passt die Erkennung nicht, folgt ein neuer Versuch (bis zu 5).
  Danach wird exakt hinter dem letzten Wort geschnitten. Nicht verifizierte Clips stehen am Ende im Log.
- Ausgabe: `public/voices/oche-<lang>/<key>.m4a` (AAC 48 kbit/s) und `manifest.json`.
- Etwa 12 s pro Clip auf einem M4 (GPU über MPS); beide Pakete zusammen rund 3 Stunden.
- Einzelne Clips neu: `generate.py de --only score_180,bust`.

## Sprecher-Aufnahme schneiden (echte Stimme)

Für einen echten Sprecher: Skript `docs/sprecher/Oche-Recording-Script.pdf`, Anfrage `docs/sprecher/fiverr-anfrage.md`.
Skript neu erzeugen (nach Änderungen an `src/caller/voicepack.ts`): `npx tsx scripts/voicepack/make-script.ts`.

Gelieferte WAV-Dateien z. B. nach `.cache/sprecher/` legen, dann:

```bash
.cache/tts-venv/bin/python scripts/voicepack/cut.py .cache/sprecher/*.wav --speaker "Name des Sprechers"
open .cache/cut-review/index.html     # jede Zeile anhören, rot = fehlt, gelb = unsicher erkannt
```

- Pausen ≥ 0,7 s trennen die Äußerungen; jede wird mit Vosk erkannt und per Sequenz-Ausrichtung der
  Skriptzeile zugeordnet. Versprecher: der letzte Take gewinnt. Gerede wird übersprungen, fehlende Zeilen gemeldet.
- „× 3 takes“-Zeilen (180, Match) werden als Varianten gespeichert (`key`, `key~2`, `key~3`); die App wechselt zufällig.
- Ergebnis: `public/voices/oche-en/*.m4a`, `manifest.json`, Eintrag in `public/voices/index.json`.
- Fehlt eine Zeile, spricht dort die Systemstimme – oder Sprecher um Nachlieferung bitten und erneut schneiden.
- Getestet mit einer simulierten Lieferung (2 Dateien, Versprecher, vergessene Zeile, Gerede): 398 Äußerungen,
  alles korrekt zugeordnet, fehlende Zeile gemeldet.
