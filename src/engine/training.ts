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

/**
 * 121 (Checkout-Leiter): neun Darts für das Ziel.
 * Geschafft → eins höher, nicht geschafft → eins tiefer, aber nie unter `floor` (121 bzw. „Safehouse“).
 * Bogeys (159, 162, …) werden in beide Richtungen übersprungen; Obergrenze 170.
 */
export function next121(target: number, success: boolean, floor = 121): number {
  const step = success ? 1 : -1;
  let t = target + step;
  while (t > floor && t < 170 && !isFinishable(t, 'double', 3)) t += step;
  return Math.max(floor, Math.min(170, t));
}

/** Safehouse: Checkout in höchstens drei Darts sichert das geschaffte Ziel als neue Untergrenze. */
export function safehouse121(floor: number, target: number, success: boolean, darts: number): number {
  return success && darts <= 3 ? Math.max(floor, target) : floor;
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
