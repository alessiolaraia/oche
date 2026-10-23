import { dartValue, isFinishable, isFinishingDart } from './checkouts';
import type { Dart, MatchConfig } from './types';

/**
 * Einzeldarts auswerten: Summe bilden, Checkout nur auf einem gültigen Finish-Dart,
 * sonst Bust; Darts aufs Doppel werden mitgezählt.
 */
export function evaluateDarts(
  darts: Dart[],
  remaining: number,
  out: MatchConfig['outMode'],
): { score: number; bust: boolean; dartsUsed?: number; dartsAtDouble: number } {
  let rest = remaining;
  let atDouble = 0;
  for (let i = 0; i < darts.length; i++) {
    const d = darts[i]!;
    if (out !== 'straight' && isFinishable(rest, out, 1)) atDouble++;
    rest -= dartValue(d);
    if (rest === 0) {
      return isFinishingDart(d, out)
        ? { score: remaining, bust: false, dartsUsed: i + 1, dartsAtDouble: atDouble }
        : { score: 0, bust: true, dartsAtDouble: atDouble };
    }
    if (rest < 0 || (rest === 1 && out !== 'straight'))
      return { score: 0, bust: true, dartsAtDouble: atDouble };
  }
  return { score: remaining - rest, bust: false, dartsAtDouble: atDouble };
}
