# Oche – Designrichtung („Oche Night“)

Erarbeitet mit dem `frontend-design`-Skill. Das Briefing gibt Dunkel, Matt, Dartboard-Farben und eine
kondensierte Display-Schrift vor; das wird umgesetzt. Frei waren Konzept, Schriften und Layout.

## Subjekt, Publikum, Aufgabe
- **Subjekt:** Steeldarts in der Kneipe, im Keller, im Vereinsheim. Licht kommt meist nur von der Board-Beleuchtung.
- **Publikum:** Spieler am Abwurf, 2,37 m vom Board, Gerät 2–3 m entfernt, oft ohne Brille, Darts in der Hand.
- **Hauptaufgabe:** den Rest aus der Distanz lesbar machen und zeigen, ob die App gehört hat.

## Konzept: der Bildschirmrand ist der Doppelring
Das eine mutige Element: Der gesamte Bildschirmrand ist ein **Ring** wie der Doppelring eines Boards. Er ist der
Mikrofon-Status und aus jeder Entfernung zu sehen:
- hört zu → Sisal-Ton, atmet langsam
- Sprache erkannt → Helligkeit folgt dem Pegel
- angenommen → Ring und Fläche blitzen **grün** (Board-Grün)
- abgelehnt / Bust → **rot** (Board-Rot)
- pausiert → Draht-Grau, gestrichelt

Alles andere bleibt ruhig: eine riesige Zahl in Sisal-Beige auf mattem Board-Schwarz, kleine Nebeninformation.

## Farben
| Token | Hex | Rolle |
|---|---|---|
| `--board` | `#1a1714` | Fläche. Das warme, matte Schwarz eines Boards (bewusst nicht #000/#111). |
| `--board-raised` | `#24201b` | Pads, Felder |
| `--sisal` | `#e3d3b0` | Restzahl, Haupttext. Farbe der Sisalfaser. |
| `--sisal-dim` | `#9a8b70` | Nebentext |
| `--wire` | `#8c877d` | Linien, pausiert. Der Metalldraht der Segmente. |
| `--ring-red` | `#d2372c` | abgelehnt, Bust, Fehler |
| `--ring-green` | `#2fa463` | angenommen, Checkout |

Rot und Grün tragen **nur Bedeutung**, nie Dekoration. Kontrast Sisal auf Board: 12,4:1.
Hell-Modus (helle Räume): Sisal-Fläche `#efe4cc`, Board-Schwarz als Schrift, Ringfarben etwas dunkler.

## Schrift
- **Big Shoulders Display** (variabel, 900): Restzahl, Spielername, Ansagen-Text. Kondensiert, mit Charakter der
  Chicagoer Beschilderung; schmal genug, dass „501“ hochkant den Bildschirm füllt.
  Ziffern stehen in Zellen fester Breite → die Zahl springt nicht, wenn sich Ziffern ändern.
- **Barlow** (400/600): alles andere. Aus Verkehrsschildern abgeleitet, auf Distanz gut lesbar.
- Skala (Ratio 1,333): 14 · 16 · 21 · 28 · 37 · 50 px; die Restzahl wird per `clamp()`/Container-Höhe skaliert.
- Keine Versalien-Labels, keine Monospace-Datenlabels.

## Layout
Hochformat:
```
╔══════════════════════════════╗  ← Ring (Mic-Status)
║ Anna          Leg 2 · 1:0    ║
║                              ║
║          ███  ███ ███        ║
║          █ █  █   █ █        ║  ← Rest, ~50 % Höhe
║          ███  ███ ███        ║
║        T20 T11 D14           ║  ← Checkout-Weg (nur ≤ 170)
║   zuletzt 60                 ║
║ ──────────────────────────── ║
║ Ben 456      1 Leg   Ø 54,2  ║
║ [ Tippen ]  [ Zurück ]       ║
╚══════════════════════════════╝
```
Querformat: Zahl links (zwei Drittel), rechts Spalte mit Gegnern, Checkout, Eingabe.
Ausrichtung: Zahl zentriert, alles andere linksbündig.

## Prinzipien
1. Distanz zuerst: Was nicht aus 2,5 m nötig ist, ist klein oder versteckt.
2. Farbe heißt etwas: Grün = angenommen, Rot = abgelehnt. Sonst Sisal und Draht.
3. Bewegung nur als Antwort (Blitz bei Eingabe) und als Atem des Rings. `prefers-reduced-motion` → kein Atmen,
   Blitz als statischer Farbwechsel.
4. Touch ist immer da, aber zurückhaltend: Das Pad schiebt sich nur bei Bedarf ein.

## Gegen-Check (Skill: Standard-Muster vermeiden)
- „Near-black mit einer grellen Akzentfarbe“: Briefing verlangt Dunkel + Rot/Grün. Angepasst: warmes Board-Schwarz,
  Text in Sisal statt Weiß, **zwei** Signalfarben mit fester Bedeutung, kein Neon.
- „Große Zahl, kleines Label, Gradient“: Die große Zahl ist hier die Aufgabe selbst; kein Gradient, kein Label darüber.
- Mittelpunkte als Trenner: im Spiel nur bei Leg-/Set-Stand, sonst Kommas und Zeilen.
- Karten-Kit vermieden: Einstellungen als Listen mit Drahtlinien, nicht als Kartenstapel.
