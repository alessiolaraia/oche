// Trainingsmodi als reine Funktionen.
import type { Rng } from './bot';
import { isFinishable } from './checkouts';

export type TrainingMode = 'atc' | 'checkout' | '121';

/** Zufälliger, checkbarer Rest 2–170 (ohne Bogeys). */
export function randomCheckoutTarget(rng: Rng): number {
  for (;;) {
    const t = 2 + Math.floor(rng() * 169);
    if (isFinishable(t, 'double', 3)) return t;
  }
}

/** 121-Challenge: geschafft → eins höher (Bogeys überspringen), nicht geschafft → gleiches Ziel. */
export function next121(target: number, success: boolean): number {
  if (!success) return target;
  let t = Math.min(170, target + 1);
  while (t < 170 && !isFinishable(t, 'double', 3)) t++;
  return t;
}

/** Around the Clock: 1 → 20, dann Bull (21). Fertig bei 22. */
export interface AtcState {
  target: number;
  darts: number;
}

export const ATC_BULL = 21;
export const ATC_DONE = 22;

export function atcStart(): AtcState {
  return { target: 1, darts: 0 };
}

/** Eine Aufnahme mit `hits` Treffern (0–3): jeder Treffer rückt ein Ziel weiter. */
export function atcApply(s: AtcState, hits: number): AtcState {
  if (s.target >= ATC_DONE) return s;
  const h = Math.max(0, Math.min(3, Math.round(hits)));
  const target = Math.min(ATC_DONE, s.target + h);
  // Beim letzten Treffer zählen nur die Darts bis dahin (vereinfacht: alle Treffer kamen zuerst)
  const darts = s.darts + (target === ATC_DONE ? Math.max(1, ATC_DONE - s.target) : 3);
  return { target, darts };
}

export function atcLabel(target: number): string {
  return target === ATC_BULL ? 'Bull' : target >= ATC_DONE ? 'Fertig' : String(target);
}
