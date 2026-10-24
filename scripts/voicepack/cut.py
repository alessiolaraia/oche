"""Schneidet eine Sprecher-Aufnahme automatisch in Oche-Clips.

Ablauf: Pausen finden → jede Äußerung mit Vosk erkennen → per Sequenz-Ausrichtung den Skriptzeilen
(docs/sprecher/script-en.json) zuordnen. Versprecher/Wiederholungen: der letzte Take gewinnt;
Zeilen mit mehreren Takes behalten die letzten N als Varianten. Gerede zwischendurch wird übersprungen,
fehlende Zeilen werden gemeldet. Danach: Ränder schneiden, Lautheit je Intensität angleichen, AAC + Manifest.

Aufruf (aus ~/oche):
  .cache/tts-venv/bin/python scripts/voicepack/cut.py aufnahme/part1.wav aufnahme/part2.wav \
      --speaker "Name des Sprechers"
Optionen: --out public/voices/oche-en  --script docs/sprecher/script-en.json  --dry-run
Prüfseite danach: .cache/cut-review/index.html (jede Zeile mit Erkennung, Ähnlichkeit, Abspielen).
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from vosk import KaldiRecognizer, Model, SetLogLevel

SR = 44100
VOSK_MODEL = ".cache/vosk-model-small-en-us-0.15"
LUFS = {"calm": -19.0, "normal": -18.0, "ton": -16.0, "big": -14.5, "max": -13.0}
MIN_GAP = 0.7  # Sekunden Stille, ab der eine neue Äußerung beginnt
MIN_LEN = 0.15
GOOD = 0.75  # ab dieser Ähnlichkeit gilt eine Zeile als sicher erkannt
RETAKE_MIN = 0.55  # darunter zählt eine Äußerung nicht als neuer Take derselben Zeile


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def sim(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def segments(y: np.ndarray, sr: int):
    """Äußerungen als (start, ende) in Samples, getrennt durch Pausen ≥ MIN_GAP."""
    frame = int(0.02 * sr)
    rms = np.array([np.sqrt(np.mean(y[i : i + frame] ** 2) + 1e-12) for i in range(0, len(y), frame)])
    db = 20 * np.log10(rms)
    floor = np.percentile(db, 10)
    thr = max(floor + 12, db.max() - 45)
    speech = db > thr
    segs, start, last = [], None, None
    gap = int(MIN_GAP / 0.02)
    for i, s in enumerate(speech):
        if s:
            if start is None:
                start = i
            last = i
        elif start is not None and i - last > gap:
            segs.append((start, last))
            start = None
    if start is not None:
        segs.append((start, last))
    out = []
    for a, b in segs:
        if (b - a + 1) * 0.02 >= MIN_LEN:
            out.append((max(0, a * frame - int(0.06 * sr)), min(len(y), (b + 1) * frame + int(0.12 * sr))))
    return out


def transcribe(model: Model, y: np.ndarray, sr: int) -> str:
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    rec = KaldiRecognizer(model, 16000)
    rec.AcceptWaveform((np.clip(y16, -1, 1) * 32767).astype(np.int16).tobytes())
    return json.loads(rec.FinalResult()).get("text", "")


def align(texts: list[str], lines: list[dict]):
    """Dynamische Programmierung: Äußerungen → Zeilen. Rückgabe: Liste (Äußerung, Zeile|None)."""
    n, m = len(texts), len(lines)
    NEG = -1e9
    SKIP_SEG, SKIP_LINE, MAX_SKIP = -0.3, -0.6, 3
    # dp[i][j]: i Äußerungen verbraucht, j Zeilen „geöffnet“ (aktuelle Zeile = j-1)
    dp = np.full((n + 1, m + 1), NEG)
    back = {}
    dp[0][0] = 0.0
    S = {}

    def s(i, j):
        if (i, j) not in S:
            S[(i, j)] = sim(texts[i], lines[j]["text"])
        return S[(i, j)]

    for i in range(n):
        for j in range(m + 1):
            cur = dp[i][j]
            if cur <= NEG / 2:
                continue
            # Äußerung überspringen (Gerede, Räuspern)
            if cur + SKIP_SEG > dp[i + 1][j]:
                dp[i + 1][j] = cur + SKIP_SEG
                back[(i + 1, j)] = (i, j, None)
            # weiterer Take der aktuellen Zeile (Versprecher → späterer Take gewinnt) –
            # nur wenn er wirklich nach der Zeile klingt, sonst ist es Gerede
            if j >= 1 and s(i, j - 1) >= RETAKE_MIN:
                v = cur + s(i, j - 1) - 0.45
                if v > dp[i + 1][j]:
                    dp[i + 1][j] = v
                    back[(i + 1, j)] = (i, j, j - 1)
            # nächste Zeile(n) öffnen, ggf. fehlende Zeilen überspringen
            for k in range(MAX_SKIP + 1):
                t = j + k
                if t >= m:
                    break
                v = cur + s(i, t) - 0.5 + k * SKIP_LINE
                if v > dp[i + 1][t + 1]:
                    dp[i + 1][t + 1] = v
                    back[(i + 1, t + 1)] = (i, j, t)
    # bestes Ende: alle Äußerungen verbraucht, fehlende Zeilen am Schluss bestrafen
    j_end = max(range(m + 1), key=lambda j: dp[n][j] + (m - j) * SKIP_LINE)
    pairs, i, j = [], n, j_end
    while i > 0:
        pi, pj, line = back[(i, j)]
        pairs.append((pi, line))
        i, j = pi, pj
    return list(reversed(pairs))


def finish(y: np.ndarray, sr: int, lufs: float) -> np.ndarray:
    frame = int(0.01 * sr)
    rms = np.array([np.sqrt(np.mean(y[i : i + frame] ** 2) + 1e-12) for i in range(0, len(y), frame)])
    on = np.where(rms > rms.max() * 0.04)[0]
    y = y[max(0, on[0] * frame - int(0.02 * sr)) : min(len(y), (on[-1] + 1) * frame + int(0.08 * sr))].copy()
    f = int(0.02 * sr)
    y[-f:] *= np.linspace(1, 0, f)
    y[: int(0.004 * sr)] *= np.linspace(0, 1, int(0.004 * sr))
    meter = pyln.Meter(sr, block_size=0.2)
    padded = np.concatenate([y, np.zeros(int(0.3 * sr))]) if len(y) < 0.5 * sr else y
    try:
        loud = meter.integrated_loudness(padded)
        if np.isfinite(loud):
            y = y * 10 ** ((lufs - loud) / 20)
    except ValueError:
        pass
    peak = np.abs(y).max()
    return y * (0.93 / peak) if peak > 0.93 else y


def encode(y: np.ndarray, sr: int, path: str):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, y, sr, subtype="PCM_16")
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", tmp.name, path], check=True)
        os.unlink(tmp.name)


def register_pack(out_dir: str, pack_id: str):
    """Trägt das Paket in <voices>/index.json ein (die App lädt nur gelistete Pakete)."""
    path = os.path.join(os.path.dirname(os.path.abspath(out_dir)), "index.json")
    idx = json.load(open(path)) if os.path.exists(path) else {"packs": []}
    if pack_id not in idx["packs"]:
        idx["packs"].append(pack_id)
    json.dump(idx, open(path, "w"), indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--script", default="docs/sprecher/script-en.json")
    ap.add_argument("--out", default="public/voices/oche-en")
    ap.add_argument("--speaker", default="Sprecher")
    ap.add_argument("--review", default=".cache/cut-review")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lines = json.load(open(args.script))
    SetLogLevel(-1)
    model = Model(VOSK_MODEL)

    utter = []  # (Datei, Audio, Text)
    for f in sorted(args.files):
        y, _ = librosa.load(f, sr=SR, mono=True)
        segs = segments(y, SR)
        for a, b in segs:
            part = y[a:b]
            utter.append((os.path.basename(f), a / SR, part, transcribe(model, part, SR)))
        print(f"{f}: {len(segs)} Äußerungen", flush=True)

    pairs = align([u[3] for u in utter], lines)
    takes = {}
    skipped = []
    for ui, li in pairs:
        if li is None:
            skipped.append(ui)
        else:
            takes.setdefault(li, []).append(ui)

    os.makedirs(args.review, exist_ok=True)
    if not args.dry_run:
        os.makedirs(args.out, exist_ok=True)
    clips, alts, rows, missing, weak = {}, {}, [], [], []
    for li, line in enumerate(lines):
        chosen = takes.get(li, [])[-line["takes"] :]
        if not chosen:
            missing.append(line)
            rows.append((line, None, 0.0, []))
            continue
        files = []
        best = 0.0
        for t, ui in enumerate(chosen):
            y = finish(utter[ui][2], SR, LUFS[line["level"]])
            score = sim(utter[ui][3], line["text"])
            best = max(best, score)
            for key in line["keys"]:
                name = key if t == 0 else f"{key}~{t + 1}"
                if not args.dry_run:
                    encode(y, SR, f"{args.out}/{name}.m4a")
                clips[name] = round(len(y) / SR, 2)
                files.append(name)
            if len(chosen) > 1:
                for key in line["keys"]:
                    alts[key] = len(chosen)
        if best < GOOD:
            weak.append((line, utter[chosen[-1]][3], best))
        rows.append((line, utter[chosen[-1]][3], best, files))

    if not args.dry_run:
        manifest = {
            "id": "oche-en",
            "lang": "en",
            "name": f"Oche Caller ({args.speaker})",
            "license": f"Aufnahme: {args.speaker}. Kommerzielle Nutzungsrechte für Oche erworben. Keine Weitergabe außerhalb von Oche.",
            "format": "m4a",
            "clips": clips,
            "alts": alts,
        }
        json.dump(manifest, open(f"{args.out}/manifest.json", "w"), ensure_ascii=False, indent=1)
        register_pack(args.out, manifest["id"])

    # Prüfseite
    rel = os.path.relpath(args.out, args.review)
    trs = []
    for line, heard, score, files in rows:
        cls = "miss" if heard is None else ("weak" if score < GOOD else "ok")
        players = "".join(f'<audio controls preload="none" src="{rel}/{f}.m4a"></audio>' for f in files[:3])
        trs.append(
            f'<tr class="{cls}"><td>{line["no"]}</td><td>{html.escape(line["text"])}</td>'
            f'<td>{html.escape(heard or "– fehlt –")}</td><td>{score:.2f}</td><td>{players}</td></tr>'
        )
    page = f"""<!doctype html><meta charset="utf-8"><title>Oche – Schnitt prüfen</title>
<style>body{{font:14px system-ui;margin:20px}} td{{padding:3px 8px;border-bottom:1px solid #ddd}}
tr.miss{{background:#fde2e0}} tr.weak{{background:#fff4d6}} audio{{height:28px}}</style>
<h1>Schnitt prüfen</h1><p>{len(lines)} Zeilen, {len(missing)} fehlen, {len(weak)} unsicher,
{len(skipped)} Äußerungen übersprungen.</p>
<table><tr><th>#</th><th>Skript</th><th>Erkannt</th><th>Ähnlichkeit</th><th>Anhören</th></tr>{''.join(trs)}</table>"""
    open(f"{args.review}/index.html", "w").write(page)

    print(f"Äußerungen: {len(utter)}, übersprungen: {len(skipped)}")
    print(f"Zeilen: {len(lines)}, fehlen: {len(missing)}, unsicher: {len(weak)}, Clips: {len(clips)}")
    for line in missing:
        print(f"  FEHLT  #{line['no']} {line['text']}")
    for line, heard, score in weak:
        print(f"  PRÜFEN #{line['no']} {line['text']!r} ← gehört {heard!r} ({score:.2f})")
    print(f"Prüfseite: {args.review}/index.html")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
