// S4 – Sprachsegmente aus dem 16-kHz-Strom schneiden (rein, testbar).
// Eingang: beliebig große 16-kHz-Blöcke. Pro 512-Sample-Frame liefert `prob()` die Sprach-
// wahrscheinlichkeit (Silero oder Energie-Fallback). Ausgang: nur Sprache (mit Pre-Roll) geht an die
// Erkennung; nach jedem Segment folgt kurze Stille, damit Vosk das Satzende sicher abschließt.

export const FRAME = 512; // 32 ms bei 16 kHz

export interface VadOptions {
  /** ab dieser Wahrscheinlichkeit beginnt Sprache */
  positive: number;
  /** darunter zählt ein Frame als Stille */
  negative: number;
  preRollMs: number;
  /** so lange Stille, bis ein Segment endet */
  redemptionMs: number;
  minSpeechMs: number;
  maxSpeechMs: number;
}

export const DEFAULT_VAD: VadOptions = {
  positive: 0.5,
  negative: 0.35,
  preRollMs: 350,
  redemptionMs: 300,
  minSpeechMs: 250,
  maxSpeechMs: 5000,
};

const ms = (frames: number) => (frames * FRAME * 1000) / 16000;
const frames = (millis: number) => Math.max(1, Math.round((millis * 16000) / 1000 / FRAME));

export interface VadEvents {
  /** Audio an die Erkennung (Pre-Roll, Sprache, abschließende Stille). */
  emit: (pcm: Float32Array) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (durationMs: number, kept: boolean) => void;
  onProb?: (p: number) => void;
}

export class VadGate {
  private buf = new Float32Array(0);
  private preRoll: Float32Array[] = [];
  private speaking = false;
  private silentFrames = 0;
  private speechFrames = 0;
  /** Frames, die wirklich nach Sprache klangen (ohne Nachlauf-Stille) – für die Mindestdauer. */
  private voicedFrames = 0;
  private pending: Float32Array[] = [];
  private readonly o: VadOptions;
  private readonly prob: (frame: Float32Array) => Promise<number> | number;
  private readonly ev: VadEvents;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    prob: (frame: Float32Array) => Promise<number> | number,
    ev: VadEvents,
    o: Partial<VadOptions> = {},
  ) {
    this.prob = prob;
    this.ev = ev;
    this.o = { ...DEFAULT_VAD, ...o };
  }

  /** Blöcke in Reihenfolge verarbeiten (Modell ist asynchron). */
  push(pcm: Float32Array): Promise<void> {
    this.queue = this.queue.then(() => this.process(pcm));
    return this.queue;
  }

  /** Offenes Segment abschließen (Datei zu Ende). */
  flush(): Promise<void> {
    this.queue = this.queue.then(() => {
      if (this.speaking) this.endSegment();
    });
    return this.queue;
  }

  private async process(pcm: Float32Array) {
    const joined = new Float32Array(this.buf.length + pcm.length);
    joined.set(this.buf);
    joined.set(pcm, this.buf.length);
    let off = 0;
    while (off + FRAME <= joined.length) {
      const frame = joined.slice(off, off + FRAME);
      off += FRAME;
      const p = await this.prob(frame);
      this.ev.onProb?.(p);
      this.step(frame, p);
    }
    this.buf = joined.slice(off);
  }

  private step(frame: Float32Array, p: number) {
    if (!this.speaking) {
      if (p >= this.o.positive) {
        this.speaking = true;
        this.silentFrames = 0;
        this.speechFrames = 1;
        this.voicedFrames = 1;
        this.pending = [...this.preRoll, frame];
        this.preRoll = [];
        this.ev.onSpeechStart?.();
        return;
      }
      this.preRoll.push(frame);
      if (this.preRoll.length > frames(this.o.preRollMs)) this.preRoll.shift();
      return;
    }
    this.pending.push(frame);
    this.speechFrames++;
    if (p >= this.o.negative) this.voicedFrames++;
    this.silentFrames = p < this.o.negative ? this.silentFrames + 1 : 0;
    if (this.silentFrames >= frames(this.o.redemptionMs) || this.speechFrames >= frames(this.o.maxSpeechMs)) {
      this.endSegment();
    }
  }

  private endSegment() {
    const dur = ms(this.speechFrames);
    const kept = ms(this.voicedFrames) >= this.o.minSpeechMs;
    if (kept) {
      for (const f of this.pending) this.ev.emit(f);
      this.ev.emit(new Float32Array(8000)); // 0,5 s Stille: Vosk schließt das Segment ab
    }
    this.ev.onSpeechEnd?.(dur, kept);
    this.speaking = false;
    this.pending = [];
    this.silentFrames = 0;
    this.speechFrames = 0;
    this.voicedFrames = 0;
  }
}

/** Energie-VAD als Fallback (ohne ONNX): adaptiver Rauschboden, Wahrscheinlichkeit aus dem Abstand. */
export function energyProb(): (frame: Float32Array) => number {
  let floor = -60;
  return (frame) => {
    let sq = 0;
    for (let i = 0; i < frame.length; i++) sq += frame[i]! * frame[i]!;
    const db = 10 * Math.log10(sq / frame.length + 1e-12);
    // Rauschboden folgt langsam nach oben, schnell nach unten
    floor = db < floor ? db : floor + 0.02 * (db - floor);
    const margin = db - floor;
    return Math.max(0, Math.min(1, (margin - 6) / 12));
  };
}
