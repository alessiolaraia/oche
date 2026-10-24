"""Erzeugt ein Oche-Klang-Paket mit Chatterbox (MIT) – eigene Stimme, keine Imitation echter Caller.

Jeder Clip wird von Vosk zurückgehört: nur wenn die erwartete Phrase erkannt wird, wird er genommen und
exakt nach dem letzten Wort abgeschnitten. Sonst neuer Versuch mit anderem Seed.
Intensität (Emotionsstärke + Lautheit) kommt aus dem Level des Clips (src/caller/voicepack.ts).

Aufruf (aus ~/oche):  .cache/tts-venv/bin/python scripts/voicepack/generate.py de [--only score_180,bust]
Vorher:               npx tsx scripts/voicepack/export-spec.ts
"""
import argparse, json, os, re, subprocess, sys, tempfile, time
from difflib import SequenceMatcher

import numpy as np
import pyloudnorm as pyln
import torch
from vosk import KaldiRecognizer, Model, SetLogLevel

# Gewichte sind für CUDA gespeichert → auf Macs zuerst auf die CPU laden
_load = torch.load
torch.load = lambda *a, **k: _load(*a, **{**k, "map_location": k.get("map_location") or "cpu"})
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from style import STYLE, build_refs, hall, stretch_tail, styled_text  # noqa: E402

VOSK_MODEL = {"de": ".cache/vosk-model-small-de-0.15", "en": ".cache/vosk-model-small-en-us-0.15"}
ACCEPT = 0.82
TRIES = 5


def norm(s: str) -> str:
    return re.sub(r"[^a-zäöüß]", "", s.lower())


def to16k(wav: np.ndarray, sr: int) -> bytes:
    n = int(len(wav) * 16000 / sr)
    x = np.interp(np.linspace(0, len(wav) - 1, n), np.arange(len(wav)), wav)
    return (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()


def recognize(model: Model, wav: np.ndarray, sr: int):
    rec = KaldiRecognizer(model, 16000)
    rec.SetWords(True)
    rec.AcceptWaveform(to16k(wav, sr))
    words = json.loads(rec.FinalResult()).get("result", [])
    return [(w["word"], w["start"], w["end"]) for w in words]


def match(words, expected: str):
    """Kürzester Wort-Präfix, der zur Erwartung passt → (Ähnlichkeit, Start, Ende, Start letztes Wort)."""
    exp = norm(expected)
    best = (0.0, 0.0, 0.0, 0.0)
    acc = ""
    for i, (w, s, e) in enumerate(words):
        acc += norm(w)
        r = SequenceMatcher(None, acc, exp).ratio()
        if r > best[0] + 1e-6:
            best = (r, words[0][1], e, s)
        if len(acc) > len(exp) * 1.6:
            break
    return best


def energy_trim(wav: np.ndarray, sr: int, start=None, end=None):
    """Schneidet auf [start, end] (Sekunden) bzw. auf den hörbaren Bereich, mit kleinem Rand."""
    frame = int(sr * 0.02)
    rms = np.array([np.sqrt(np.mean(wav[i : i + frame] ** 2) + 1e-12) for i in range(0, len(wav), frame)])
    thr = max(rms.max() * 0.06, 1e-4)
    loud = np.where(rms > thr)[0]
    a = loud[0] * frame if len(loud) else 0
    b = (loud[-1] + 1) * frame if len(loud) else len(wav)
    if start is not None:
        a = max(a, int((start - 0.12) * sr))
    if end is not None:
        b = min(b, int((end + 0.18) * sr))
    a = max(0, a - int(0.03 * sr))
    energy_trim.start = a / sr  # Schnittbeginn in Sekunden (für Zeitangaben danach)
    out = wav[a:b].copy()
    fade = min(len(out), int(0.03 * sr))
    if fade > 0:
        out[-fade:] *= np.linspace(1, 0, fade)
        out[: int(0.005 * sr)] *= np.linspace(0, 1, int(0.005 * sr))
    return out


def loudness(wav: np.ndarray, sr: int, target: float) -> np.ndarray:
    meter = pyln.Meter(sr, block_size=0.2)
    padded = np.concatenate([wav, np.zeros(int(0.25 * sr))]) if len(wav) < 0.45 * sr else wav
    try:
        lufs = meter.integrated_loudness(padded)
        gain = 10 ** ((target - lufs) / 20) if np.isfinite(lufs) else 1.0
    except ValueError:
        gain = 1.0
    out = wav * gain
    peak = np.abs(out).max()
    return out * (0.93 / peak) if peak > 0.93 else out


def max_tokens(text: str) -> int:
    # Sprach-Tokens laufen mit 25 Hz; großzügig, aber ohne endloses Weiterbrabbeln
    return int(25 * (0.8 + 0.085 * len(text)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lang", choices=["de", "en"])
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    lang = args.lang
    clips = json.load(open(f".cache/voicepack-{lang}.json"))
    if args.only:
        keys = set(args.only.split(","))
        clips = [c for c in clips if c["key"] in keys]
    out_dir = args.out or f"public/voices/oche-{lang}"
    os.makedirs(out_dir, exist_ok=True)
    report_path = f"{out_dir}/../{os.path.basename(out_dir)}-report.json" if args.out else f".cache/voicepack-{lang}-report.json"
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}

    SetLogLevel(-1)
    vosk = Model(VOSK_MODEL[lang])
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tts = ChatterboxMultilingualTTS.from_pretrained(device=dev)
    limit = {"n": 1000}
    inference = tts.t3.inference
    tts.t3.inference = lambda *a, **k: inference(*a, **{**k, "max_new_tokens": limit["n"]})
    sr = tts.sr

    # Referenzstimmen einmal vorberechnen (Chatterbox würde sie sonst bei jedem Clip neu analysieren)
    refs = build_refs()
    conds = {}
    for level, (ref, ex, *_rest) in STYLE.items():
        tts.prepare_conditionals(refs[ref], exaggeration=ex)
        conds[level] = tts.conds

    todo = [c for c in clips if args.only or not os.path.exists(f"{out_dir}/{c['key']}.m4a")]
    t0 = time.time()
    for i, c in enumerate(todo):
        _ref, ex, cfg, stretch, semis, wet, lufs = STYLE[c["level"]]
        say = styled_text(c["text"], c["level"], lang)
        limit["n"] = max_tokens(say)
        tts.conds = conds[c["level"]]
        best = None
        for attempt in range(TRIES):
            torch.manual_seed(1000 + attempt * 7919 + hash(c["key"]) % 1000)
            try:
                wav = tts.generate(say, language_id=lang, exaggeration=ex, cfg_weight=cfg, temperature=0.7)
            except (IndexError, RuntimeError) as err:  # Randfälle in Chatterbox → nächster Versuch
                print(f"[{lang}] {c['key']} Versuch {attempt + 1} fehlgeschlagen: {err}", flush=True)
                continue
            wav = wav.squeeze(0).cpu().numpy().astype(np.float32)
            score, s, e, last = match(recognize(vosk, wav, sr), c["text"])
            if best is None or score > best[0]:
                best = (score, wav, s, e, last)
            if score >= ACCEPT:
                break
        if best is None:
            print(f"[{lang}] {c['key']} übersprungen (alle Versuche fehlgeschlagen)", flush=True)
            continue
        score, wav, s, e, last = best
        verified = score >= ACCEPT
        cut = energy_trim(wav, sr, s if verified else None, e if verified else None)
        if verified:
            # Schlusswort dehnen und anheben – Startzeit relativ zum Schnitt
            cut = stretch_tail(cut, sr, last - energy_trim.start, stretch, semis)
        cut = hall(cut, sr, wet)
        cut = loudness(cut, sr, lufs)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            import soundfile as sf

            sf.write(tmp.name, cut, sr, subtype="PCM_16")
            subprocess.run(
                ["afconvert", "-f", "m4af", "-d", "aac", "-b", "48000", tmp.name, f"{out_dir}/{c['key']}.m4a"],
                check=True,
            )
            os.unlink(tmp.name)
        report[c["key"]] = {
            "text": c["text"],
            "said": say,
            "level": c["level"],
            "match": round(score, 3),
            "verified": verified,
            "seconds": round(len(cut) / sr, 2),
            "tries": attempt + 1,
        }
        json.dump(report, open(report_path, "w"), ensure_ascii=False, indent=1)
        eta = (time.time() - t0) / (i + 1) * (len(todo) - i - 1)
        print(
            f"[{lang}] {i + 1}/{len(todo)} {c['key']:<14} {'OK ' if verified else '?? '}{score:.2f} "
            f"{len(cut) / sr:.2f}s x{attempt + 1}  noch ~{eta / 60:.0f} min",
            flush=True,
        )

    if args.out:
        print(f"[{lang}] Proben in {out_dir}")
        return
    manifest = {
        "id": f"oche-{lang}",
        "lang": lang,
        "name": "Oche Deutsch" if lang == "de" else "Oche Arena (English)",
        "license": "Erzeugt mit Chatterbox (Resemble AI, MIT). Eigene synthetische Stimme, keine Imitation realer Personen.",
        "format": "m4a",
        "clips": {k: v["seconds"] for k, v in sorted(report.items()) if os.path.exists(f"{out_dir}/{k}.m4a")},
    }
    json.dump(manifest, open(f"{out_dir}/manifest.json", "w"), ensure_ascii=False, indent=1)
    idx_path = os.path.join(os.path.dirname(os.path.abspath(out_dir)), "index.json")
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {"packs": []}
    if manifest["id"] not in idx["packs"]:
        idx["packs"].append(manifest["id"])
    json.dump(idx, open(idx_path, "w"), indent=1)
    bad = [k for k, v in report.items() if not v["verified"]]
    print(f"[{lang}] fertig, nicht verifiziert: {len(bad)} {bad[:30]}")


if __name__ == "__main__":
    sys.exit(main())
