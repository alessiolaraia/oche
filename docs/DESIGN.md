# Oche – Design: Soft Glass

Grundlage ist der Skill **Soft Glass UI** des Users (`~/Downloads/soft-glass-ui.zip`). Tokens und Bausteine stehen
unverändert in `src/ui/soft-glass.css`, die App-Bausteine darauf in `src/ui/styles.css`.

## Look

Milchiges Frostglas auf warmem Off-White, weiche Tiefe, tiefschwarze Pillen für die Hauptaktion. Farbe kommt nur
aus **einer** Blau→Apricot-Aura pro Screen, hinter dem wichtigsten Inhalt. Systemschrift (SF Pro), Headlines 600.

## Fokus je Screen (wo die Aura sitzt)

| Screen           | Fokus                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Spiel            | Rest des Spielers am Zug – die Aura ist zugleich die **Mikro-Anzeige** |
| Start            | Schnellstart-Karte (501)                                               |
| Onboarding       | unten links, hinter dem Inhalt                                         |
| Matchende        | Siegername                                                             |
| Around the Clock | aktuelles Ziel                                                         |

## Mikro-Status aus 2–3 m

- Aura **atmet** = hört zu; **wächst mit dem Pegel** = Sprache erkannt; **grau** = pausiert oder aus.
- Kleiner Status-Chip oben („Hört zu“) für die Nahsicht.
- Bestätigung: Vollbild-Blitz **hell** (angenommen, mit der Zahl) oder **dunkel** (abgelehnt / Bust). Hell gegen dunkel
  ist aus der Distanz eindeutig und bleibt in der Palette (Ink, Milchglas, Schwarz).

## Spielansicht

- Handy hoch: Fokus (Name, riesige Restzahl, Ø-Chip, Checkout-Weg) oben, darunter die **Anzeigetafel**, unten die
  Steuerleiste (Tippen, Zurück, schwarzer Mikro-Knopf).
- Anzeigetafel: jeder Spieler mit **eigenem** Namen, Rest, Legs und Average in einer Zeile; der Spieler am Zug ist
  als Glas-Kachel mit Punkt hervorgehoben. Darunter „Zuletzt: Name – Punkte“.
- Mac, Tablet, Handy quer: Fokus links, Tafel und Pad rechts.
- Pad offen (Handy hoch): Fokus weicht, die Tafel zeigt nur noch den Spieler am Zug.

## Einstellungen

Vier Karten – Mikrofon (Abstand + Raumlautstärke + Test), Sprache, Ansagen, Spiel. Alles Feine liegt unter
„Erweitert“. Die Kalibrierung rechnet aus Abstand und Lautstärke Verstärkung, Noise Gate und Erkennungs-Strenge
(`presetCalibration` in `src/voice/audio/calibrationMath.ts`); „Automatisch messen“ bleibt unter „Erweitert“.

## Regeln (aus dem Skill)

- Nur Ink, Milchglas, Schwarz und eine Aura. Keine bunten Buttons, kein Neon, keine harten grauen Ränder.
- Höchstens zwei schwarze Pillen pro Screen. Karten Radius 26, Kacheln 20, Buttons Pille.
- Schatten immer warm getönt. `prefers-reduced-transparency` und `prefers-reduced-motion` werden beachtet.
