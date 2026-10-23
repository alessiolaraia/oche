import { isFinishable } from './checkouts';
import type { Format, InMode, OutMode } from './types';

/** Mit drei Darts nicht erreichbare Aufnahmen. */
export const IMPOSSIBLE_VISITS: readonly number[] = [163, 166, 169, 172, 173, 175, 176, 178, 179];

export function isPossibleVisit(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_VISITS.includes(score);
}

export function winsNeeded(format: Format): number {
  return format.mode === 'firstTo' ? format.count : Math.floor(format.count / 2) + 1;
}

export function startsIn(inMode: InMode): boolean {
  return inMode === 'straight';
}

export type VisitOutcome =
  | { ok: true; kind: 'score'; remainingAfter: number }
  | { ok: true; kind: 'notIn' }
  | { ok: true; kind: 'bust'; reason: 'declared' | 'overshoot' | 'leftOne' }
  | { ok: true; kind: 'checkout' }
  | { ok: false; reason: 'impossible' | 'notFinishable' | 'gameOver' };

/**
 * Bewertet eine Aufnahme gegen den aktuellen Rest.
 * Bei Gesamtpunkt-Eingabe vertrauen wir darauf, dass ein Checkout auf dem richtigen Segment endete –
 * prüfen aber, dass der Rest mit der angegebenen Dartzahl überhaupt checkbar ist.
 */
export function evaluateVisit(
  remaining: number,
  isIn: boolean,
  score: number,
  out: OutMode,
  opts: { bust?: boolean; dartsUsed?: number } = {},
): VisitOutcome {
  if (opts.bust) return { ok: true, kind: 'bust', reason: 'declared' };
  if (!isPossibleVisit(score)) return { ok: false, reason: 'impossible' };
  if (!isIn)
    return score === 0 ? { ok: true, kind: 'notIn' } : evaluateVisit(remaining, true, score, out, opts);

  const after = remaining - score;
  if (after < 0) return { ok: true, kind: 'bust', reason: 'overshoot' };
  if (after === 1 && out !== 'straight') return { ok: true, kind: 'bust', reason: 'leftOne' };
  if (after === 0) {
    return isFinishable(remaining, out, opts.dartsUsed ?? 3)
      ? { ok: true, kind: 'checkout' }
      : { ok: false, reason: 'notFinishable' };
  }
  return { ok: true, kind: 'score', remainingAfter: after };
}
