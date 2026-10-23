export type InMode = 'straight' | 'double' | 'master';
export type OutMode = 'straight' | 'double' | 'master';
export type FormatMode = 'firstTo' | 'bestOf';
export type StartOrder = 'alternate' | 'bullOut';

export interface Format {
  mode: FormatMode;
  count: number;
}

export interface Player {
  id: string;
  name: string;
  /** Bot-Gegner: Ziel-3-Dart-Average. */
  bot?: { average: number };
}

export interface MatchConfig {
  startScore: number;
  inMode: InMode;
  outMode: OutMode;
  /** Legs pro Set (oder pro Match, wenn `sets` null ist). */
  legs: Format;
  sets: Format | null;
  players: Player[];
  startOrder: StartOrder;
}

export type Multiplier = 1 | 2 | 3;
/** Einzeldart: segment 1–20, 25 = Bull (Single 25, Double 50), 0 = daneben. */
export interface Dart {
  segment: number;
  multiplier: Multiplier;
}

export interface VisitEvent {
  type: 'visit';
  id: string;
  /** Angesagte Gesamtpunktzahl der Aufnahme. */
  score: number;
  /** Explizit „überworfen“ angesagt. */
  bust?: boolean;
  /** Optional: die drei Einzeldarts (Board-Pad oder „Triple zwanzig, …“). */
  darts?: Dart[];
  /** Bei Checkout: mit wie vielen Darts (1–3). */
  dartsUsed?: number;
  /** Optional: Darts aufs Doppel in dieser Aufnahme (für Checkout-Quote). */
  dartsAtDouble?: number;
  ts: number;
}

/** Bull-Out-Ergebnis: wer das Match beginnt. */
export interface StarterEvent {
  type: 'starter';
  id: string;
  player: number;
  ts: number;
}

/** „Neues Leg“: aktuelles Leg verwerfen und neu beginnen (gleicher Starter). */
export interface RestartLegEvent {
  type: 'restartLeg';
  id: string;
  ts: number;
}

export type MatchEvent = VisitEvent | StarterEvent | RestartLegEvent;

export interface VisitResult {
  eventId: string;
  player: number;
  /** Angesagte Punktzahl. */
  declared: number;
  /** Gewertete Punkte (0 bei Bust oder noch nicht „drin“). */
  scored: number;
  bust: boolean;
  checkout: boolean;
  remainingBefore: number;
  remainingAfter: number;
  /** Geworfene Darts (3, bei Checkout ggf. weniger). */
  darts: number;
  dartsAtDouble?: number;
  /** Ob der Spieler bei Aufnahmebeginn eine Finish-Chance hatte. */
  hadCheckoutChance: boolean;
  legNumber: number;
  setNumber: number;
}

export interface LegRecord {
  legNumber: number;
  setNumber: number;
  starter: number;
  winner: number;
  visits: VisitResult[];
}

export interface PlayerState {
  remaining: number;
  isIn: boolean;
  legsWon: number;
  setsWon: number;
}

export interface MatchState {
  config: MatchConfig;
  players: PlayerState[];
  /** Index des Spielers am Zug. */
  current: number;
  /** Starter des Matches (nach Bull-Out oder Spieler 0). */
  matchStarter: number;
  legStarter: number;
  /** Fortlaufend, 1-basiert. */
  legNumber: number;
  setNumber: number;
  /** Leg innerhalb des aktuellen Sets, 1-basiert. */
  legInSet: number;
  currentLeg: VisitResult[];
  legs: LegRecord[];
  winner: number | null;
  lastVisit: VisitResult | null;
}
