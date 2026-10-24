"""Caller-Stil für das Oche-Klang-Paket: Referenzstimme, Textgestaltung und Nachbearbeitung.

Stimme: Thorsten-Voice (Thorsten Müller, CC0 – ausdrücklich für Sprachsynthese freigegeben).
Ruhige Ansagen nutzen „neutral“, gerufene Ansagen „angry“ (laut, hohe Stimmlage) als Referenz.
Stil-Merkmale (allgemein, keine Imitation einer Person): Spannungspause vor dem letzten Teil, mehr Energie
bei großen Zahlen. Trocken wie direkt ins Mikro gesprochen (Hall und Nachbearbeitung klangen künstlich).
"""
import glob
import os
import re

import librosa
import numpy as np
import soundfile as sf

THORSTEN = ".cache/thorsten-emotional_v02"
REF_DIR = ".cache/voice-refs"

# Level → (Referenz, exaggeration, cfg, Dehnung Schlusswort, Halbtöne höher am Ende, Hall-Anteil, LUFS)
STYLE = {
    # trocken wie direkt ins Mikro: kein Hall, keine nachträgliche Dehnung/Tonhöhe (klang künstlich)
    "calm": ("neutral", 0.45, 0.5, 1.0, 0.0, 0.0, -19.0),
    "normal": ("neutral", 0.6, 0.45, 1.0, 0.0, 0.0, -18.0),
    "ton": ("shout", 0.9, 0.35, 1.0, 0.0, 0.0, -16.0),
    "big": ("shout", 1.2, 0.3, 1.0, 0.0, 0.0, -14.5),
    "max": ("shout", 1.6, 0.25, 1.0, 0.0, 0.0, -13.0),
}


def build_refs() -> dict:
    """Je eine ~12-s-Referenz aus mehreren Thorsten-Aufnahmen (ruhig / gerufen)."""
    os.makedirs(REF_DIR, exist_ok=True)
    out = {}
    # OCHE_SHOUT=surprised → tiefere, weniger schrille Rufstimme
    shout = os.environ.get("OCHE_SHOUT", "angry,surprised").split(",")
    for name, emos in (("neutral", ["neutral"]), ("shout", shout)):
        path = f"{REF_DIR}/{name}-{'-'.join(emos)}.wav"
        if not os.path.exists(path):
            parts, total = [], 0.0
            files = sorted(f for e in emos for f in glob.glob(f"{THORSTEN}/{e}/*.wav"))
            # lauteste Aufnahmen zuerst (bei „shout“), sonst die ersten
            scored = []
            for f in files[:120]:
                y, sr = librosa.load(f, sr=24000)
                scored.append((float(np.sqrt(np.mean(y**2))), f, y))
            if name == "shout":
                scored.sort(reverse=True)
            for _r, _f, y in scored:
                parts += [y, np.zeros(int(0.25 * 24000), dtype=np.float32)]
                total += len(y) / 24000
                if total > 12:
                    break
            sf.write(path, np.concatenate(parts), 24000)
        out[name] = path
    return out


def styled_text(text: str, level: str, lang: str) -> str:
    """Spannungspause vor dem Schlussteil bei großen Zahlen: „One hundred… and eighty!“"""
    if level not in ("ton", "big", "max"):
        return text
    if lang == "en":
        return re.sub(r"^One hundred and ", "One hundred... and ", text)
    if lang == "de":
        return re.sub(r"^Hundert(?=[a-zäöü])", "Hundert... ", text)
    return text


def stretch_tail(wav: np.ndarray, sr: int, tail_start: float, factor: float, semitones: float) -> np.ndarray:
    """Dehnt das Schlusswort (ab tail_start Sekunden) und hebt es leicht an."""
    if factor <= 1.01 and abs(semitones) < 0.1:
        return wav
    i = max(0, min(len(wav) - 1, int(tail_start * sr)))
    head, tail = wav[:i], wav[i:]
    if len(tail) < sr * 0.08:
        return wav
    if factor > 1.01:
        tail = librosa.effects.time_stretch(tail, rate=1 / factor)
    if abs(semitones) >= 0.1:
        tail = librosa.effects.pitch_shift(tail, sr=sr, n_steps=semitones)
    # weicher Übergang
    x = min(len(head), len(tail), int(0.015 * sr))
    if x > 0:
        fade = np.linspace(0, 1, x)
        tail[:x] = tail[:x] * fade + head[-x:] * (1 - fade)
        head = head[:-x]
    return np.concatenate([head, tail]).astype(np.float32)


def hall(wav: np.ndarray, sr: int, wet: float, seconds: float = 1.1) -> np.ndarray:
    """Einfacher Hallen-Nachhall: abklingendes, gefiltertes Rauschen als Impulsantwort."""
    if wet <= 0:
        return wav
    n = int(seconds * sr)
    rng = np.random.default_rng(7)
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-np.linspace(0, 7, n)).astype(np.float32)
    ir[: int(0.012 * sr)] = 0  # Vorverzögerung
    ir = librosa.effects.preemphasis(ir, coef=-0.6)  # dunkler
    ir /= np.sqrt(np.sum(ir**2)) + 1e-9
    wetsig = np.convolve(wav, ir)[: len(wav) + int(0.6 * sr)]
    dry = np.concatenate([wav, np.zeros(len(wetsig) - len(wav), dtype=np.float32)])
    out = dry * (1 - wet) + wetsig * wet * 2.2
    fade = int(0.25 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out.astype(np.float32)
