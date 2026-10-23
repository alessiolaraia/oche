import { create } from 'zustand';

export type MicStatus = 'off' | 'loading' | 'listening' | 'hearing' | 'paused';
export type EngineKind = 'vosk' | 'webspeech' | 'none';

export interface RawResult {
  at: number;
  text: string;
  /** Mittlere Wort-Konfidenz (Vosk) bzw. Konfidenz der Web Speech API. */
  confidence: number | null;
  accepted: boolean;
  note?: string;
}

interface VoiceStore {
  status: MicStatus;
  engine: EngineKind;
  /** Pegel 0–1 nach Gain/Gate (für Ring und Pegelanzeige). */
  level: number;
  /** Pegel vor dem Gate in dBFS. */
  inputDb: number;
  gateOpen: boolean;
  sampleRate: number | null;
  partial: string;
  results: RawResult[];
  error: string | null;
  warnings: string[];
  modelProgress: string | null;
  /** Testmodus: Erkanntes nur anzeigen, nicht ausführen. */
  testMode: boolean;
  set: (patch: Partial<Omit<VoiceStore, 'set' | 'pushResult'>>) => void;
  pushResult: (r: RawResult) => void;
}

export const useVoice = create<VoiceStore>()((set) => ({
  status: 'off',
  engine: 'none',
  level: 0,
  inputDb: -100,
  gateOpen: false,
  sampleRate: null,
  partial: '',
  results: [],
  error: null,
  warnings: [],
  modelProgress: null,
  testMode: false,
  set: (patch) => set(patch),
  pushResult: (r) => set((s) => ({ results: [r, ...s.results].slice(0, 20) })),
}));
