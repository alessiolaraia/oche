import { createVoskClient, type KaldiRecognizer, type VoskClient } from '@lichess-org/vosk-browser';
import type { SpeechEngine, Transcript } from './engine';
import { modelUrl } from './vocab';

const RATE = 16000;

/** Vosk offline im Web Worker, mit Grammatik → erkennt praktisch nur Darts-Sprache. */
export class VoskEngine implements SpeechEngine {
  readonly kind = 'vosk' as const;
  onTranscript: ((t: Transcript) => void) | null = null;
  onPartial: ((text: string) => void) | null = null;
  onError: ((message: string) => void) | null = null;
  private client: VoskClient | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private grammar: string[];

  constructor(grammar: string[]) {
    this.grammar = grammar;
  }

  async start(): Promise<void> {
    if (this.client) return;
    const base = import.meta.env.BASE_URL;
    this.client = await createVoskClient({
      modelUrl: new URL(modelUrl(), location.href).toString(),
      workerUrl: `${base}vosk/vosk.worker.js`,
      wasmUrl: new URL(`${base}vosk/vosk.wasm`, location.href).toString(),
      logLevel: -1,
    });
    this.client.on('error', (m) => this.onError?.('error' in m ? m.error : 'Vosk-Fehler'));
    this.createRecognizer();
  }

  private createRecognizer() {
    if (!this.client) return;
    this.recognizer?.remove();
    const rec = new this.client.KaldiRecognizer(RATE, JSON.stringify(this.grammar));
    rec.setWords(true);
    rec.on('result', (m) => {
      if (m.event !== 'result') return;
      const text = m.result.text.trim();
      if (!text) return;
      const words = m.result.result ?? [];
      const confidence = words.length ? words.reduce((s, w) => s + w.conf, 0) / words.length : null;
      this.onTranscript?.({
        text,
        alternatives: [],
        confidence,
        words: words.map((w) => ({ word: w.word, conf: w.conf })),
      });
    });
    rec.on('partialresult', (m) => {
      if (m.event === 'partialresult') this.onPartial?.(m.result.partial);
    });
    rec.on('error', (m) => {
      if (m.event === 'error') this.onError?.(m.error);
    });
    this.recognizer = rec;
  }

  setGrammar(phrases: string[]): void {
    this.grammar = phrases;
    this.createRecognizer();
  }

  feed(pcm: Float32Array): void {
    this.recognizer?.acceptWaveformFloat(pcm, RATE);
  }

  stop(): void {
    this.recognizer?.remove();
    this.recognizer = null;
    this.client?.terminate();
    this.client = null;
  }
}
