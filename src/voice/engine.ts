import type { EngineKind } from '../store/voice';

export interface Transcript {
  /** Beste Hypothese. */
  text: string;
  /** Weitere Hypothesen (Web Speech), in Reihenfolge. */
  alternatives: string[];
  /** 0–1 oder null, wenn die Engine keine liefert. */
  confidence: number | null;
}

/** Austauschbare Spracherkennung (Vosk im Browser, Web Speech API, später ggf. nativ via Capacitor). */
export interface SpeechEngine {
  readonly kind: EngineKind;
  onTranscript: ((t: Transcript) => void) | null;
  onPartial: ((text: string) => void) | null;
  onError: ((message: string) => void) | null;
  start(): Promise<void>;
  stop(): void;
  /** Nur Vosk: Audio aus der eigenen Pipeline (16 kHz, Float32). */
  feed?(pcm: Float32Array): void;
  /** Nur Vosk: Grammatik neu setzen (z. B. anderes Triggerwort). */
  setGrammar?(phrases: string[]): void;
}
