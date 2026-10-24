#!/bin/sh
# Erzeugt deutsche Test-Sprachdateien (16 kHz, mono, 16 bit) für den Sprach-E2E-Test.
# Nur macOS (nutzt `say`). Eigene Aufnahmen: siehe test/audio/README.md.
set -e
cd "$(dirname "$0")/../test/audio"
VOICE="${VOICE:-Anna}"
P='[[slnc 2600]]' # Pause zwischen Befehlen – Vosk braucht Stille als Satzende

mk() { # name text
  say -v "$VOICE" -o "$1.wav" --file-format=WAVE --data-format=LEI16@16000 "[[slnc 12000]] $2 [[slnc 3000]]"
  echo "test/audio/$1.wav"
}

mk wurf-sechzig "Wurf sechzig. $P Wurf sechzig. $P Wurf sechzig."
# Nur „Wurf + Zahl“ und „Wurf zurück“ zählen; „Zurück“ allein und frühere Befehle (Überworfen, Korrektur) lösen nichts aus.
mk befehle "Wurf hunderteinundvierzig. $P Wurf fünfundvierzig. $P Zurück. $P Wurf zurück. $P Wurf sechzig. $P Überworfen. $P Wurf. [[slnc 1300]] Hundert. $P Korrektur zehn."
mk smalltalk "Ich habe heute wirklich keine Lust auf Arbeit. $P Hast du das Spiel gestern gesehen? $P Sechzig Leute waren da."

# Komplettes Match 501, Double-Out, First to 3 – nur per Stimme, mit Bust und Korrektur.
# A wirft 180, 180, 141; B wirft 60er. Leg 2 beginnt B.
LEG_A="Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hunderteinundvierzig. $P"
LEG_B="Wurf sechzig. $P Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hunderteinundvierzig. $P"
# Leg 1 mit Bust (150 > 141) und Korrektur per „Wurf zurück“
LEG_1="Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hundertachtzig. $P Wurf sechzig. $P Wurf hundertfünfzig. $P Wurf fünfundvierzig. $P Wurf zurück. $P Wurf sechzig. $P Wurf hunderteinundvierzig. $P"
mk match "$LEG_1 $LEG_B $LEG_A"
