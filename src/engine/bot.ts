// Bot-Gegner: simuliert Einzeldarts mit Trefferwahrscheinlichkeiten, die zum Ziel-Average passen.
import { BULL, checkoutRoute, dartValue, isFinishingDart } from './checkouts';
import type { Dart, OutMode } from './types';

export type Rng = () => number;

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nachbarsegmente im Uhrzeigersinn auf dem Board. */
const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function neighbour(seg: number, rng: Rng): number {
  const i = BOARD.indexOf(seg);
  if (i < 0) return seg;
  return BOARD[(i + (rng() < 0.5 ? 1 : BOARD.length - 1)) % BOARD.length]!;
}

export interface BotSkill {
  /** Wahrscheinlichkeit, ein anvisiertes Triple zu treffen. */
  treble: number;
  /** Wahrscheinlichkeit, ein anvisiertes Doppel zu treffen. */
  double: number;
  /** Wahrscheinlichkeit, das Board ganz zu verfehlen. */
  offBoard: number;
}

/** Gleicht aus, dass Stellen und Doppel-Fehlwürfe den Average drücken (per Simulation kalibriert). */
const CALIBRATION = 1.16;

/** Leitet Trefferquoten aus dem Ziel-3-Dart-Average ab (grob kalibriert, siehe Test). */
export function skillFor(average: number): BotSkill {
  const perDart = (Math.max(15, Math.min(110, average)) * CALIBRATION) / 3;
  const singleValue = 15.5; // Erwartung bei verfehltem Triple: S20 oder Nachbar (1/5)
  const double = Math.min(0.5, 0.06 + average * 0.0034);
  if (perDart >= singleValue) {
    return { treble: Math.min(0.85, (perDart - singleValue) / (60 - singleValue)), double, offBoard: 0 };
  }
  return { treble: 0.01, double, offBoard: Math.min(0.6, 1 - perDart / singleValue) };
}

/** Ein Wurf auf ein Ziel. */
export function throwAt(target: Dart, skill: BotSkill, rng: Rng): Dart {
  if (rng() < skill.offBoard) return { segment: 0, multiplier: 1 };
  const r = rng();
  if (target.segment === BULL) {
    const p = target.multiplier === 2 ? skill.double : 0.6;
    if (r < p) return target;
    if (r < p + 0.35) return { segment: BULL, multiplier: 1 };
    return { segment: Math.ceil(rng() * 20), multiplier: 1 };
  }
  if (target.multiplier === 3) {
    if (r < skill.treble) return target;
    // meist Single im Segment, sonst Nachbar
    return {
      segment: r < skill.treble + (1 - skill.treble) * 0.7 ? target.segment : neighbour(target.segment, rng),
      multiplier: 1,
    };
  }
  if (target.multiplier === 2) {
    if (r < skill.double) return target;
    // halb außerhalb (daneben), halb Single
    return rng() < 0.5 ? { segment: 0, multiplier: 1 } : { segment: target.segment, multiplier: 1 };
  }
  return r < 0.88 ? target : { segment: neighbour(target.segment, rng), multiplier: 1 };
}

const T20: Dart = { segment: 20, multiplier: 3 };

/** Simuliert eine Aufnahme (bis 3 Darts; endet früher bei Checkout oder Bust). */
export function botVisit(remaining: number, out: OutMode, skill: BotSkill, rng: Rng): Dart[] {
  const darts: Dart[] = [];
  let rest = remaining;
  for (let i = 0; i < 3; i++) {
    const left = 3 - i;
    const route = checkoutRoute(rest, out, left);
    let target: Dart;
    if (route) target = route[0]!;
    else if (rest > 60 + (out === 'double' ? 2 : 0) || out === 'straight') target = T20;
    else {
      // stellen: auf ein gerades Doppel hinarbeiten
      target = {
        segment: Math.min(20, Math.max(1, rest - 32 > 0 ? rest - 32 : rest - 16 > 0 ? rest - 16 : 1)),
        multiplier: 1,
      };
    }
    const hit = throwAt(target, skill, rng);
    darts.push(hit);
    rest -= dartValue(hit);
    if (rest === 0 && isFinishingDart(hit, out)) break;
    if (rest < 0 || rest === 0 || (rest === 1 && out !== 'straight')) break; // Bust
  }
  return darts;
}
