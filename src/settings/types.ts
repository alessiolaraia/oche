import type { Format, InMode, OutMode, StartOrder } from '../engine/types';

export type VoiceMode = 'trigger' | 'direct';
export type EnginePreference = 'auto' | 'vosk' | 'webspeech';
export type CallerStyle = 'plain' | 'arena';
export type Theme = 'dark' | 'light';

export interface Settings {
  game: {
    startScore: number;
    inMode: InMode;
    outMode: OutMode;
    legs: Format;
    sets: Format | null;
    startOrder: StartOrder;
    /** Nach Checkout per Sprache nachfragen: „Mit wie vielen Darts?“ */
    askCheckoutDarts: boolean;
    /** Zusätzlich: „Darts auf Doppel?“ */
    askDartsAtDouble: boolean;
  };
  players: {
    /** Zuletzt benutzte Namen, für Schnellstart. */
    recent: string[];
  };
  voice: {
    enabled: boolean;
    engine: EnginePreference;
    mode: VoiceMode;
    trigger: string;
    /** 0–1: Ergebnisse mit geringerer mittlerer Wort-Konfidenz werden verworfen. */
    minConfidence: number;
    gainDb: number;
    /** Noise Gate in dBFS (z. B. -50). */
    gateDb: number;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    confirmWindowMs: number;
    /** Einzeldarts („Triple zwanzig, Doppel zehn …“) erkennen. */
    singleDarts: boolean;
  };
  caller: {
    enabled: boolean;
    style: CallerStyle;
    voiceURI: string | null;
    rate: number;
    pitch: number;
    volume: number;
    announceScore: boolean;
    announceRemaining: boolean;
    announceTurn: boolean;
    announceCheckoutRoute: boolean;
    specialCalls: boolean;
    sfx: boolean;
  };
  display: {
    theme: Theme;
    showCheckoutRoute: boolean;
    keepAwake: boolean;
    boardPad: boolean;
  };
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  game: {
    startScore: 501,
    inMode: 'straight',
    outMode: 'double',
    legs: { mode: 'firstTo', count: 3 },
    sets: null,
    startOrder: 'alternate',
    askCheckoutDarts: true,
    askDartsAtDouble: false,
  },
  players: { recent: ['Spieler 1', 'Spieler 2'] },
  voice: {
    enabled: true,
    engine: 'auto',
    mode: 'trigger',
    trigger: 'wurf',
    minConfidence: 0.55,
    gainDb: 12,
    gateDb: -55,
    noiseSuppression: true,
    autoGainControl: false,
    confirmWindowMs: 3000,
    singleDarts: true,
  },
  caller: {
    enabled: true,
    style: 'plain',
    voiceURI: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    announceScore: true,
    announceRemaining: true,
    announceTurn: true,
    announceCheckoutRoute: false,
    specialCalls: true,
    sfx: true,
  },
  display: { theme: 'dark', showCheckoutRoute: true, keepAwake: true, boardPad: false },
  onboarded: false,
};
