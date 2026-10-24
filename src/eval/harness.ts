// Eval-Gerüst (docs/VOICE_MASTERPROMPT.md §9): Audiodatei → dieselbe Kette wie das Mikrofon (S2–S4)
// → Vosk mit derselben Grammatik (S5) → dieselbe Entscheidung (decide, S6–S8).
// Wird nur unter #/eval geladen und vom Playwright-Runner (test/eval/voice-eval.spec.ts) gesteuert.
import { createVoskClient, type KaldiRecognizer, type VoskClient } from '@lichess-org/vosk-browser';
import type { Command } from '../voice/commands';
import { buildGrammar } from '../voice/commands';
import { decide, type DecideContext, type Decision } from '../voice/decide/decide';
import type { Transcript } from '../voice/engine';
import { processBuffer } from '../voice/audio/pipeline';
import { loadSilero } from '../voice/audio/sileroVad';
import { energyProb, VadGate } from '../voice/audio/vadGate';
import { loadVocab, modelUrl } from '../voice/vocab';

export interface EvalConfig {
  gainDb: number;
  gateDb: number;
  /** Pegelkorrektur der Datei vor der Kette (simuliert den Mikrofonpegel aus 2,5 m). */
  inputDb: number;
  minConfidence: number;
  /** Strengere Schwelle fürs Triggerwort (S5). */
  triggerMinConfidence?: number;
  mode: DecideContext['mode'];
  trigger: string;
  singleDarts: boolean;
  /** Feature-Flags der neuen Stufen (siehe settings.voice.flags). */
  dsp2?: boolean;
  /** S4: Sprachsegmente per VAD statt Gate (Gate dann ganz offen). */
  vad?: 'silero' | 'energy';
}

export interface FileResult {
  transcripts: Transcript[];
  decisions: Decision[];
  accepted: Command[];
  /** Nur im Echtzeit-Modus: ms vom Sprechende bis zur ersten Annahme. */
  latencyMs: number | null;
}

let client: VoskClient | null = null;
let grammarKey = '';
let grammar: string[] = [];

async function init(cfg: EvalConfig): Promise<void> {
  const base = import.meta.env.BASE_URL;
  client ??= await createVoskClient({
    modelUrl: new URL(modelUrl(), location.href).toString(),
    workerUrl: `${base}vosk/vosk.worker.js`,
    wasmUrl: new URL(`${base}vosk/vosk.wasm`, location.href).toString(),
    logLevel: -1,
  });
  const key = cfg.trigger;
  if (key !== grammarKey) {
    grammar = buildGrammar({ trigger: cfg.trigger, vocab: await loadVocab() });
    grammarKey = key;
  }
}

async function decode(b64: string, inputDb: number): Promise<AudioBuffer> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const tmp = new OfflineAudioContext(1, 1, 48000);
  const buf = await tmp.decodeAudioData(bytes.buffer);
  const g = 10 ** (inputDb / 20);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = data[i]! * g;
  return buf;
}

async function runFile(
  b64: string,
  cfg: EvalConfig,
  opts: { realtime?: boolean; speechEnd?: number | null } = {},
): Promise<FileResult> {
  await init(cfg);
  const c = client!;
  const buffer = await decode(b64, cfg.inputDb);
  const rec: KaldiRecognizer = new c.KaldiRecognizer(16000, JSON.stringify(grammar));
  rec.setWords(true);
  const out: FileResult = { transcripts: [], decisions: [], accepted: [], latencyMs: null };
  let lastEvent = performance.now();
  let startedAt = 0;
  let armedUntil = 0;
  const ctx: DecideContext = {
    mode: cfg.mode,
    trigger: cfg.trigger,
    minConfidence: cfg.minConfidence,
    triggerMinConfidence: cfg.triggerMinConfidence ?? 0,
    paused: false,
    echoMuted: false,
  };
  rec.on('result', (m) => {
    lastEvent = performance.now();
    if (m.event !== 'result') return;
    const text = m.result.text.trim();
    if (!text) return;
    const words = m.result.result ?? [];
    const t: Transcript = {
      text,
      alternatives: [],
      confidence: words.length ? words.reduce((s, w) => s + w.conf, 0) / words.length : null,
      words: words.map((w) => ({ word: w.word, conf: w.conf })),
    };
    out.transcripts.push(t);
    const d = decide(t, { ...ctx, armed: performance.now() < armedUntil });
    if (d.kind === 'arm') armedUntil = performance.now() + 4000;
    out.decisions.push(d);
    if (d.kind === 'accept') {
      out.accepted.push(d.command);
      if (opts.realtime && opts.speechEnd != null && out.latencyMs === null)
        out.latencyMs = Math.round(performance.now() - (startedAt + opts.speechEnd * 1000));
    }
  });
  rec.on('partialresult', () => {
    lastEvent = performance.now();
  });

  const toVosk = (pcm: Float32Array) => rec.acceptWaveformFloat(pcm, 16000);
  const prob = cfg.vad === 'silero' ? await loadSilero() : cfg.vad === 'energy' ? energyProb() : null;
  const gate = prob ? new VadGate(prob, { emit: toVosk }) : null;
  const run = await processBuffer(
    buffer,
    { gainDb: cfg.gainDb, gateDb: gate ? -120 : cfg.gateDb, dsp2: cfg.dsp2 },
    { onChunk: (pcm) => (gate ? void gate.push(pcm) : toVosk(pcm)), realtime: opts.realtime },
  );
  startedAt = run.startedAt;
  if (gate) await gate.flush();
  // Stille anhängen, damit Vosk das letzte Wort abschließt, dann warten, bis nichts mehr kommt
  rec.acceptWaveformFloat(new Float32Array(16000), 16000);
  rec.retrieveFinalResult();
  lastEvent = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => (performance.now() - lastEvent > 900 ? resolve() : setTimeout(tick, 100));
    setTimeout(tick, 100);
  });
  rec.remove();
  return out;
}

export const api = { init, runFile };

declare global {
  interface Window {
    __ocheEval?: typeof api;
  }
}
