"""Synthetischer Start-Korpus für die Sprach-Eval (docs/VOICE_MASTERPROMPT.md §9).

Deutsche macOS-Stimmen (`say`) sprechen Befehle; danach wird eine Wurfsituation simuliert:
Raumhall, Abstand 2,5 m (leiser + dumpfer), Grundrauschen, Dart-Einschläge, Gerede/Musik im Hintergrund.
Echte Aufnahmen gehören nach test/voice-corpus/real/ und haben in der Auswertung Vorrang.

Aufruf (aus ~/oche, nur macOS):  .cache/tts-venv/bin/python scripts/voice-corpus/generate.py
Ergebnis: test/voice-corpus/{commands,confusables,negatives}/*.ogg (Opus, 16 kHz) + test/voice-corpus/index.json
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, lfilter, resample_poly

SR = 22050
OUT = "test/voice-corpus"
VOICES = ["Anna", "Flo (Deutsch (Deutschland))", "Sandy (Deutsch (Deutschland))"]
VOICE_TAG = {"Anna": "anna", "Flo (Deutsch (Deutschland))": "flo", "Sandy (Deutsch (Deutschland))": "sandy"}
rng = np.random.default_rng(42)

# Zahlwörter wie im Parser (src/voice/numbers.de.ts)
UNITS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
         "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"]
TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"]
ONES = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"]


def words(n: int) -> str:
    if n < 20:
        return UNITS[n]
    if n < 100:
        t, o = divmod(n, 10)
        return TENS[t] if o == 0 else f"{ONES[o]}und{TENS[t]}"
    r = n - 100
    return "hundert" if r == 0 else f"hundert{words(r)}"


CONFUSABLE_PAIRS = [(16, 60), (17, 70), (14, 40), (18, 80), (19, 90), (13, 30), (15, 50), (2, 3), (12, 20)]
CONFUSABLES = sorted({n for p in CONFUSABLE_PAIRS for n in p})
NUMBERS = [0, 1, 5, 7, 9, 11, 21, 26, 41, 45, 57, 81, 85, 95, 99, 100, 101, 121, 125, 140, 141, 160, 171, 177, 180]
# Nur „Trigger + Zahl“ und „Zurück“ sind Befehle; frühere Befehle gehören zu den Negativen (dürfen nichts auslösen)
COMMANDS = [
    ("Zurück.", "zurueck", {"type": "undo"}),
    ("Wurf nichts.", "wurf_nichts", {"type": "score", "value": 0}),
    ("Überworfen.", "ueberworfen", None),
    ("Korrektur fünfundvierzig.", "korrektur_45", None),
    ("Rest.", "rest", None),
    ("Neues Leg.", "neues_leg", None),
]
CHATTER = [
    "Hast du gestern das Spiel gesehen? Das war echt knapp.",
    "Ich hol mir noch was zu trinken, willst du auch was?",
    "Sechzig Leute waren auf der Feier, total voll.",
    "Der Würfel ist vom Tisch gefallen.",
    "Die Wurst vom Grill war richtig gut.",
    "Hundertachtzig Euro hat das neue Board gekostet.",
    "Ich wurde gestern zum Essen eingeladen.",
    "Wirf doch mal auf die zwanzig, nicht immer auf die eins.",
    "Das war ein guter Wurf, aber leider daneben.",
    "Lass uns noch ein Leg spielen, dann gehen wir.",
    "Der Fernseher ist zu laut, mach mal leiser.",
    "Morgen soll es regnen, sagt der Wetterbericht.",
]
APP_SPEECH = ["Sechzig. Rest vierhunderteinundvierzig.", "Hundertachtzig!", "Du brauchst zweiunddreißig.",
              "Überworfen. Rest hunderteinundvierzig.", "Check! Leg für Spieler eins."]


def say(text: str, voice: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as d:
        aiff = os.path.join(d, "x.aiff")
        for attempt in range(3):  # `say` hängt selten – mit Zeitlimit neu versuchen
            try:
                subprocess.run(["say", "-v", voice, "-o", aiff, text], check=True, timeout=30)
                break
            except subprocess.TimeoutExpired:
                if attempt == 2:
                    raise
        wav = os.path.join(d, "x.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", aiff, wav], check=True)
        y, _ = sf.read(wav, dtype="float32")
    return y


def room_ir(rt60: float = 0.45) -> np.ndarray:
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-6.9 * t / rt60)
    ir[: int(0.004 * SR)] = 0
    ir[0] = 1.0  # Direktschall
    b, a = butter(2, 4000 / (SR / 2), "low")
    return lfilter(b, a, ir).astype(np.float32) / np.sqrt(np.sum(ir**2))


IR = room_ir()


def at_distance(y: np.ndarray, metres: float = 2.5) -> np.ndarray:
    """Hall + Abstand: leiser (−6 dB pro Verdopplung ab 0,5 m) und dumpfer."""
    wet = fftconvolve(y, IR)[: len(y) + int(0.3 * SR)]
    dry = np.concatenate([y, np.zeros(len(wet) - len(y), dtype=np.float32)])
    mix = 0.55 * dry + 0.45 * wet / (np.abs(wet).max() + 1e-9) * np.abs(dry).max()
    b, a = butter(2, 6000 / (SR / 2), "low")
    mix = lfilter(b, a, mix)
    return (mix * 10 ** (-20 * np.log10(metres / 0.5) / 20)).astype(np.float32)


def pink(n: int, db: float) -> np.ndarray:
    x = np.cumsum(rng.standard_normal(n)) * 0.02
    x = x - np.convolve(x, np.ones(2000) / 2000, "same")  # Drift entfernen
    x = x / (np.sqrt(np.mean(x**2)) + 1e-9)
    return (x * 10 ** (db / 20)).astype(np.float32)


def dart_hit() -> np.ndarray:
    """Einschlag: harter Anschlag + tiefer Nachklang, ca. 120 ms."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    click = rng.standard_normal(n) * np.exp(-t * 90)
    thump = np.sin(2 * np.pi * 95 * t) * np.exp(-t * 35)
    return (0.5 * click + 0.6 * thump).astype(np.float32)


def add_at(base: np.ndarray, sig: np.ndarray, pos: int, gain: float = 1.0):
    end = min(len(base), pos + len(sig))
    base[pos:end] += sig[: end - pos] * gain


def music(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    chords = [(220, 277, 330), (196, 247, 294), (175, 220, 262), (196, 247, 294)]
    beat = int(0.5 * SR)
    for i in range(0, n, beat * 4):
        f = chords[(i // (beat * 4)) % len(chords)]
        seg = slice(i, min(n, i + beat * 4))
        for fr in f:
            out[seg] += 0.08 * np.sin(2 * np.pi * fr * t[seg])
    for i in range(0, n, beat):  # Bass-Drum
        add_at(out, (np.sin(2 * np.pi * 60 * t[:2000]) * np.exp(-t[:2000] * 30)).astype(np.float32), i, 0.4)
    return out


def scene(speech: np.ndarray, hard: bool, pad_s: float = 1.0) -> tuple[np.ndarray, float]:
    """Sprache in eine Wurfsituation setzen. Gibt Audio und Zeitpunkt des Sprechendes zurück."""
    s = at_distance(speech)
    pad = int(pad_s * SR)
    total = len(s) + 2 * pad
    out = pink(total, -52 if not hard else -44)
    add_at(out, s, pad)
    speech_end = (pad + len(speech)) / SR
    if hard:
        for _ in range(2):  # Einschläge kurz vor/nach dem Befehl
            add_at(out, dart_hit(), int(rng.uniform(0.05, 0.4) * pad), 0.35)
        babble = at_distance(say(rng.choice(CHATTER), "Reed (Deutsch (Deutschland))"), 3.5)
        add_at(out, babble[: total], 0, 0.5)
    return out, speech_end


def norm(y: np.ndarray, peak_db: float = -6.0) -> np.ndarray:
    return (y / (np.abs(y).max() + 1e-9) * 10 ** (peak_db / 20)).astype(np.float32)


OUT_SR = 16000  # Opus kann 16 kHz; das ist auch die Rate, mit der Vosk arbeitet


def write(path: str, y: np.ndarray):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    y16 = resample_poly(y, 160, 221).astype(np.float32)  # 22050 → 16000
    sf.write(path, y16, OUT_SR, format="OGG", subtype="OPUS")


def main():
    for sub in ("commands", "confusables", "negatives"):
        shutil.rmtree(f"{OUT}/{sub}", ignore_errors=True)
    index = []

    def entry(rel, set_, expected, y, speech_end=None, tags=()):
        write(f"{OUT}/{rel}", y)
        index.append({"file": rel, "set": set_, "expected": expected, "seconds": round(len(y) / SR, 2),
                      "speechEnd": None if speech_end is None else round(speech_end, 3), "tags": list(tags)})

    for voice in VOICES:
        tag = VOICE_TAG[voice]
        for hard in (False, True):
            cond = "laut" if hard else "ruhig"
            for n in NUMBERS + CONFUSABLES:
                y, end = scene(say(f"Wurf {words(n)}.", voice), hard)
                set_ = "confusables" if n in CONFUSABLES else "commands"
                entry(f"{set_}/wurf_{n}__{tag}_{cond}.ogg", set_, {"type": "score", "value": n},
                      norm(y, -14 if not hard else -10), end, [tag, cond])
            for text, slug, expected in COMMANDS:
                y, end = scene(say(text, voice), hard)
                set_ = "commands" if expected else "negatives"
                entry(f"{set_}/{slug}__{tag}_{cond}.ogg", set_, expected, norm(y, -14), end, [tag, cond])
        print("Stimme fertig:", tag, flush=True)

    # Negative: Gespräche, Fernsehen, Musik, Einschläge, App-eigene Ansagen – erwartet: nichts
    for v in VOICES:
        for i, sentence in enumerate(CHATTER):
            y, _ = scene(say(sentence, v), hard=i % 2 == 0, pad_s=0.6)
            entry(f"negatives/gespraech_{VOICE_TAG[v]}_{i:02d}.ogg", "negatives", None, norm(y, -12), None,
                  ["gespraech", VOICE_TAG[v]])
    for i, text in enumerate(APP_SPEECH):
        y, _ = scene(say(text, "Anna"), hard=False, pad_s=0.5)
        entry(f"negatives/app_ansage_{i:02d}.ogg", "negatives", None, norm(y, -10), None, ["app"])
    n = 120 * SR
    tv = music(n) * 0.6 + pink(n, -46)
    pos = 0
    for i, sentence in enumerate(CHATTER * 6):
        s = at_distance(say(sentence, VOICES[i % 3]), 3.0)
        if pos + len(s) > n:
            break
        add_at(tv, s, pos, 0.9)
        pos += len(s) + int(0.4 * SR)
    entry("negatives/fernsehen_musik.ogg", "negatives", None, norm(tv, -12), None, ["tv"])
    hits = pink(20 * SR, -50)
    for k in range(18):
        add_at(hits, dart_hit(), int((0.6 + k * 1.05 + rng.uniform(-0.1, 0.1)) * SR), 0.8)
    entry("negatives/einschlaege.ogg", "negatives", None, norm(hits, -8), None, ["einschlag"])

    json.dump(index, open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=1)
    secs = {s: round(sum(e["seconds"] for e in index if e["set"] == s)) for s in ("commands", "confusables", "negatives")}
    print(f"{len(index)} Dateien, Sekunden je Set: {secs}")


if __name__ == "__main__":
    sys.exit(main())
