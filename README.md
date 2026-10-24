# Oche

Sprachgesteuerter Darts-Scorer. Mikro an, „Wurf sechzig“ sagen, die App zieht ab und sagt den Rest an.
Läuft als Web-App auf dem Mac und als installierte App auf iPhone und Android, auch offline.

## Sprachbefehle

Bewusst nur zwei – so löst Gerede am Tisch nichts aus:

| Sagen                                                     | Wirkung                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| „Wurf sechzig“, „Wurf hundert einundvierzig“, „Wurf null“ | Punkte der Aufnahme (zu viel geworfen = Bust, erkennt die App selbst) |
| „Wurf … (kurze Pause) … sechzig“                          | geht auch getrennt                                                    |
| „Wurf zurück“ (Triggerwort + zurück)                      | letzte Aufnahme rückgängig                                            |

Das Triggerwort („Wurf“) kannst du in den Einstellungen unter „Sprache“ frei wählen – die App prüft, ob das
Sprachmodell das Wort kennt.

## Auf dem Handy installieren

**iPhone (Safari):**

1. Die Oche-Adresse in **Safari** öffnen (nicht in Chrome).
2. Unten auf **Teilen** tippen.
3. **Zum Home-Bildschirm** wählen und **Hinzufügen** tippen.
4. Oche **vom Home-Bildschirm** starten und beim ersten Start das Mikrofon erlauben.
5. Die Einrichtung durchgehen: Kalibrieren aus Abwurfdistanz, dann „Wurf sechzig“ testen.

**Android (Chrome):**

1. Die Oche-Adresse in **Chrome** öffnen.
2. Rechts oben auf das **Drei-Punkte-Menü** tippen.
3. **App installieren** (oder „Zum Startbildschirm hinzufügen“) wählen.
4. Oche vom Startbildschirm öffnen und das Mikrofon erlauben.
5. Die Einrichtung durchgehen: Kalibrieren, dann „Wurf sechzig“ testen.

Beim ersten Mikrofonstart lädt das Sprachmodell (45 MB, einmalig). Danach funktioniert alles offline.

## Entwicklung

```bash
npm install && npm run vosk && npm run model
npm run dev          # Mac
npm run dev:phone    # HTTPS im WLAN fürs Handy: https://<Mac-IP>:5173
npm test             # Unit-Tests
npm run e2e          # E2E inkl. Sprachtests mit Fake-Mikrofon
```

Architektur, Konventionen und alle Befehle: [CLAUDE.md](CLAUDE.md). Design: [docs/DESIGN.md](docs/DESIGN.md).
Eigene Testaufnahmen: [test/audio/README.md](test/audio/README.md).

Sprachmodell: [Vosk](https://alphacephei.com/vosk/) `vosk-model-small-de-0.15` (Apache 2.0), im Browser über
[@lichess-org/vosk-browser](https://github.com/lichess-org/vosk-browser).
