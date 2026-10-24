// Silero VAD v5 (MIT) über onnxruntime-web – ohne eigenes Mikrofon, wir geben die 16-kHz-Frames selbst hinein.
import * as ort from 'onnxruntime-web/wasm';
import { FRAME } from './vadGate';

const CONTEXT = 64; // Silero v5: 64 Samples Kontext aus dem vorigen Frame

let loading: Promise<(frame: Float32Array) => Promise<number>> | null = null;

/** Lädt Laufzeit + Modell (einmal) und liefert eine Funktion Frame → Sprachwahrscheinlichkeit. */
export function loadSilero(): Promise<(frame: Float32Array) => Promise<number>> {
  loading ??= (async () => {
    const base = import.meta.env.BASE_URL;
    ort.env.wasm.wasmPaths = `${base}ort/`;
    ort.env.wasm.numThreads = 1; // kein SharedArrayBuffer auf GitHub Pages
    const model = await fetch(`${base}ort/silero_vad_v5.onnx`).then((r) => {
      if (!r.ok) throw new Error(`VAD-Modell nicht gefunden (${r.status})`);
      return r.arrayBuffer();
    });
    const session = await ort.InferenceSession.create(model);
    const sr = new ort.Tensor('int64', [16000n]);
    let state: ort.Tensor = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
    let context = new Float32Array(CONTEXT);
    return async (frame: Float32Array) => {
      if (frame.length !== FRAME) throw new Error('VAD erwartet 512 Samples');
      const input = new Float32Array(CONTEXT + FRAME);
      input.set(context, 0);
      input.set(frame, CONTEXT);
      context = frame.slice(-CONTEXT);
      const out = await session.run({
        input: new ort.Tensor('float32', input, [1, input.length]),
        state,
        sr,
      });
      state = out['stateN'] as ort.Tensor;
      return (out['output']!.data as Float32Array)[0]!;
    };
  })().catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}
