import { describe, expect, it } from 'vitest';
import { matchStats } from '../../src/engine/stats';
import { reduce } from '../../src/engine/x01';
import type { MatchConfig, MatchEvent } from '../../src/engine/types';

let n = 0;
const v = (score: number, extra: Partial<Extract<MatchEvent, { type: 'visit' }>> = {}): MatchEvent => ({
  type: 'visit',
  id: `s${++n}`,
  score,
  ts: n,
  ...extra,
});
const cfg: MatchConfig = {
  startScore: 501,
  inMode: 'straight',
  outMode: 'double',
  legs: { mode: 'firstTo', count: 3 },
  sets: null,
  players: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ],
  startOrder: 'alternate',
};

describe('Statistik', () => {
  // A: 180, 180, 100, 41 (Rest 0 mit 2 Darts) → 501 in 11 Darts
  const events = [v(180), v(26), v(180), v(45), v(100), v(0, { bust: true }), v(41, { dartsUsed: 2 })];
  const s = reduce(cfg, events);

  it('3-Dart-Average und First 9', () => {
    const a = matchStats(s, 0);
    expect(a.darts).toBe(11);
    expect(a.points).toBe(501);
    expect(a.average).toBeCloseTo((501 / 11) * 3);
    expect(a.first9).toBeCloseTo(460 / 3);
  });

  it('Bänder, Highfinish, Checkout-Quote, Darts pro Leg', () => {
    const a = matchStats(s, 0);
    expect(a.count180).toBe(2);
    expect(a.count100).toBe(1);
    expect(a.highestFinish).toBe(41);
    expect(a.checkouts).toBe(1);
    expect(a.checkoutAttempts).toBe(1);
    expect(a.checkoutRate).toBe(1);
    expect(a.bestLeg).toBe(11);
    expect(a.legsWon).toBe(1);
  });

  it('Bust zählt drei Darts mit 0 Punkten', () => {
    const b = matchStats(s, 1);
    expect(b.darts).toBe(9);
    expect(b.points).toBe(71);
    expect(b.checkoutRate).toBeNull();
  });

  it('angegebene Darts aufs Doppel gehen in die Quote ein', () => {
    const s2 = reduce(cfg, [...events.slice(0, 6), v(41, { dartsUsed: 3, dartsAtDouble: 3 })]);
    expect(matchStats(s2, 0).checkoutRate).toBeCloseTo(1 / 3);
  });
});
