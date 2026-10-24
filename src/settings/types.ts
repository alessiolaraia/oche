import type { Format, InMode, OutMode, StartOrder } from '../engine/types';
import type { Environment } from '../voice/audio/calibrationMath';

export type VoiceMode = 'trigger' | 'direct';
export type EnginePreference = 'auto' | 'vosk' | 'webspeech';
export type CallerStyle = 'plain' | 'arena';
export type VoiceSource = 'pack' | 'system';

export type ArenaStyle = 'stage' | 'fire';

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
    /** 0–1: Mindest-Konfidenz des Triggerworts (strenger als die Zahl). */
    triggerMinConfidence: number;
    /** Gelernte Aliase: gesprochenes Wort → gemeintes Wort (S9). */
    aliases: Record<string, string>;
    /** Neue Stufen des Sprachsystems, per Eval freigeschaltet. */
    flags: { dsp2: boolean; vad: 'off' | 'silero' | 'energy' };
    /** Abstand Gerät ↔ Abwurf in Metern (Kalibrierung). */
    distanceM: number;
    /** Wie laut es im Raum ist (Kalibrierung). */
    environment: Environment;
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
    /** Oche-Klang-Paket (eigene Aufnahmen) oder Systemstimme; fehlende Clips spricht immer die Systemstimme. */
    voiceSource: VoiceSource;
    /** Deutsche Stimme (Stil „Nüchtern“). */
    voiceURI: string | null;
    /** Englische Stimme (Stil „Arena“). */
    voiceURIEn: string | null;
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
    showCheckoutRoute: boolean;
    keepAwake: boolean;
    boardPad: boolean;
    /** Kurzes Intro (180 + „Name vs Name“) vor jedem Spiel. */
    intro: boolean;
    /** Look des Spielbildschirms. */
    arena: ArenaStyle;
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
    askCheckoutDarts: false,
    askDartsAtDouble: false,
  },
  players: { recent: ['Spieler 1', 'Spieler 2'] },
  voice: {
    enabled: true,
    engine: 'auto',
    mode: 'trigger',
    trigger: 'wurf',
    minConfidence: 0.55,
    triggerMinConfidence: 0.72,
    aliases: {},
    flags: { dsp2: true, vad: 'off' },
    distanceM: 2.5,
    environment: 'medium',
    gainDb: 20,
    gateDb: -30,
    noiseSuppression: true,
    autoGainControl: false,
    confirmWindowMs: 3000,
    singleDarts: true,
  },
  caller: {
    enabled: true,
    style: 'plain',
    voiceSource: 'pack',
    voiceURI: null,
    voiceURIEn: null,
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
  display: { showCheckoutRoute: true, keepAwake: true, boardPad: false, intro: true, arena: 'stage' },
  onboarded: false,
};
