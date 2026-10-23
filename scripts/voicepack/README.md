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
