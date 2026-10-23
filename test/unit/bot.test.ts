import { describe, expect, it } from 'vitest';
import { botVisit, seededRng, skillFor } from '../../src/engine/bot';
import { evaluateDarts } from '../../src/engine/darts';
import { matchStats } from '../../src/engine/stats';
import type { MatchConfig, MatchEvent } from '../../src/engine/types';
import { applyEvent, initialState } from '../../src/engine/x01';

const cfg: MatchConfig = {
  startScore: 501,
  inMode: 'straight',
  outMode: 'double',
  legs: { mode: 'firstTo', count: 200 },
  sets: null,
  players: [{ id: 'bot', name: 'Bot' }],
  startOrder: 'alternate',
};

function simulate(average: number, legs: number, seed = 1) {
  const rng = seededRng(seed);
  const skill = skillFor(average);
  let state = initialState(cfg);
  let n = 0;
  while (state.legs.length < legs) {
    const rest = state.players[0]!.remaining;
    const darts = botVisit(rest, 'double', skill, rng);
    const r = evaluateDarts(darts, rest, 'double');
    const ev: MatchEvent = {
      type: 'visit',
      id: String(++n),
      score: r.score,
      ts: n,
      darts,
      ...(r.bust ? { bust: true } : {}),
      ...(r.dartsUsed ? { dartsUsed: r.dartsUsed } : {}),
    };
    state = applyEvent(state, ev);
    if (n > legs * 200) throw new Error('Bot kommt nicht zum Ende');
  }
  return matchStats(state, 0);
}

describe('Bot', () => {
  it.each([30, 50, 70, 90, 110])('Ziel-Average %i wird auf ±10 Prozent getroffen', (avg) => {
    const s = simulate(avg, 150);
    expect(s.average!).toBeGreaterThan(avg * 0.9);
    expect(s.average!).toBeLessThan(avg * 1.1);
  });

  it('ist mit gleichem Seed reproduzierbar', () => {
    expect(simulate(70, 5, 42)).toEqual(simulate(70, 5, 42));
  });

  it('wirft nie mehr als 3 Darts und nur gültige Segmente', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 2000; i++) {
      const darts = botVisit(2 + Math.floor(rng() * 500), 'double', skillFor(60), rng);
      expect(darts.length).toBeGreaterThan(0);
      expect(darts.length).toBeLessThanOrEqual(3);
      for (const d of darts)
        expect([0, ...Array.from({ length: 20 }, (_, k) => k + 1), 25]).toContain(d.segment);
    }
  });
});
