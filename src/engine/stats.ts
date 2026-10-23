import type { LegRecord, MatchState, VisitResult } from './types';

export interface PlayerStats {
  /** 3-Dart-Average. */
  average: number | null;
  first9: number | null;
  checkouts: number;
  checkoutAttempts: number;
  /** 0–1, null ohne Versuche. */
  checkoutRate: number | null;
  highestFinish: number | null;
  highestScore: number | null;
  count180: number;
  count140: number;
  count100: number;
  darts: number;
  points: number;
  legsWon: number;
  bestLeg: number | null;
  avgDartsPerWonLeg: number | null;
}

function avg3(points: number, darts: number): number | null {
  return darts > 0 ? (points / darts) * 3 : null;
}

/** Ab diesem Rest wird ohne Angabe angenommen, dass mindestens ein Dart aufs Doppel ging. */
const SHORT_FINISH = 50;

/**
 * Statistik eines Spielers aus Leg-Aufzeichnungen.
 * Checkout-Versuche: angegebene „Darts aufs Doppel“; ohne Angabe zählt ein Checkout oder eine Aufnahme
 * bei Rest ≤ 50 als ein Versuch (ein höherer Rest wird meist erst gestellt).
 */
export function statsFromLegs(
  legs: readonly LegRecord[],
  player: number,
  open: readonly VisitResult[] = [],
): PlayerStats {
  const allLegs = open.length
    ? [...legs, { visits: open, winner: -1 } as Pick<LegRecord, 'visits' | 'winner'>]
    : legs;
  let points = 0;
  let darts = 0;
  let f9Points = 0;
  let f9Darts = 0;
  let checkouts = 0;
  let attempts = 0;
  let highestFinish: number | null = null;
  let highestScore: number | null = null;
  let c180 = 0;
  let c140 = 0;
  let c100 = 0;
  const wonLegDarts: number[] = [];

  for (const leg of allLegs) {
    const mine = leg.visits.filter((v) => v.player === player);
    mine.forEach((v, i) => {
      points += v.scored;
      darts += v.darts;
      if (i < 3) {
        f9Points += v.scored;
        f9Darts += v.darts;
      }
      if (v.scored === 180) c180++;
      else if (v.scored >= 140) c140++;
      else if (v.scored >= 100) c100++;
      if (highestScore === null || v.scored > highestScore) highestScore = v.scored;
      if (v.checkout) {
        checkouts++;
        if (highestFinish === null || v.scored > highestFinish) highestFinish = v.scored;
      }
      attempts +=
        v.dartsAtDouble ?? (v.checkout || (v.hadCheckoutChance && v.remainingBefore <= SHORT_FINISH) ? 1 : 0);
    });
    if (leg.winner === player) wonLegDarts.push(mine.reduce((s, v) => s + v.darts, 0));
  }

  return {
    average: avg3(points, darts),
    first9: avg3(f9Points, f9Darts),
    checkouts,
    checkoutAttempts: attempts,
    checkoutRate: attempts > 0 ? checkouts / attempts : null,
    highestFinish,
    highestScore,
    count180: c180,
    count140: c140,
    count100: c100,
    darts,
    points,
    legsWon: wonLegDarts.length,
    bestLeg: wonLegDarts.length ? Math.min(...wonLegDarts) : null,
    avgDartsPerWonLeg: wonLegDarts.length
      ? wonLegDarts.reduce((a, b) => a + b, 0) / wonLegDarts.length
      : null,
  };
}

export function matchStats(state: MatchState, player: number): PlayerStats {
  return statsFromLegs(state.legs, player, state.currentLeg);
}
