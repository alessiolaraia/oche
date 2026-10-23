import { describe, expect, it } from 'vitest';
import { evaluateVisit, IMPOSSIBLE_VISITS, isPossibleVisit, winsNeeded } from '../../src/engine/rules';
import { ALL_DARTS, dartValue } from '../../src/engine/checkouts';

describe('Regeln', () => {
  it('unmögliche Aufnahmen entsprechen Brute-Force über drei Darts', () => {
    const vals = [0, ...ALL_DARTS.map(dartValue)];
    const possible = new Set<number>();
    for (const a of vals) for (const b of vals) for (const c of vals) possible.add(a + b + c);
    const impossible = Array.from({ length: 181 }, (_, i) => i).filter((n) => !possible.has(n));
    expect(impossible).toEqual([...IMPOSSIBLE_VISITS]);
  });

  it('isPossibleVisit lehnt > 180, negative und Kommazahlen ab', () => {
    expect(isPossibleVisit(180)).toBe(true);
    expect(isPossibleVisit(181)).toBe(false);
    expect(isPossibleVisit(-1)).toBe(false);
    expect(isPossibleVisit(12.5)).toBe(false);
    expect(isPossibleVisit(179)).toBe(false);
  });

  it('First to / Best of', () => {
    expect(winsNeeded({ mode: 'firstTo', count: 3 })).toBe(3);
    expect(winsNeeded({ mode: 'bestOf', count: 5 })).toBe(3);
    expect(winsNeeded({ mode: 'bestOf', count: 7 })).toBe(4);
  });

  describe('Double-Out', () => {
    it('normale Aufnahme', () => {
      expect(evaluateVisit(501, true, 60, 'double')).toEqual({
        ok: true,
        kind: 'score',
        remainingAfter: 441,
      });
    });
    it('Überwerfen → Bust', () => {
      expect(evaluateVisit(40, true, 60, 'double')).toMatchObject({ kind: 'bust', reason: 'overshoot' });
    });
    it('Rest 1 → Bust', () => {
      expect(evaluateVisit(41, true, 40, 'double')).toMatchObject({ kind: 'bust', reason: 'leftOne' });
    });
    it('Rest 0 → Checkout', () => {
      expect(evaluateVisit(121, true, 121, 'double')).toMatchObject({ kind: 'checkout' });
    });
    it('Checkout eines Bogey-Rests ist nicht möglich', () => {
      expect(evaluateVisit(169, true, 169, 'double')).toMatchObject({ ok: false });
      expect(evaluateVisit(159, true, 159, 'double')).toMatchObject({ ok: false, reason: 'notFinishable' });
      expect(evaluateVisit(171, true, 171, 'double')).toMatchObject({ ok: false });
    });
    it('Checkout mit zu wenigen Darts ist nicht möglich', () => {
      expect(evaluateVisit(100, true, 100, 'double', { dartsUsed: 1 })).toMatchObject({ ok: false });
      expect(evaluateVisit(100, true, 100, 'double', { dartsUsed: 2 })).toMatchObject({ kind: 'checkout' });
    });
    it('angesagtes Überworfen', () => {
      expect(evaluateVisit(100, true, 0, 'double', { bust: true })).toMatchObject({
        kind: 'bust',
        reason: 'declared',
      });
    });
    it('unmögliche Aufnahme', () => {
      expect(evaluateVisit(501, true, 163, 'double')).toEqual({ ok: false, reason: 'impossible' });
    });
  });

  it('Straight-Out: Rest 1 ist erlaubt', () => {
    expect(evaluateVisit(41, true, 40, 'straight')).toMatchObject({ kind: 'score', remainingAfter: 1 });
    expect(evaluateVisit(1, true, 1, 'straight')).toMatchObject({ kind: 'checkout' });
  });

  it('Double-In: 0 → noch nicht drin, > 0 zählt', () => {
    expect(evaluateVisit(501, false, 0, 'double')).toEqual({ ok: true, kind: 'notIn' });
    expect(evaluateVisit(501, false, 40, 'double')).toMatchObject({ kind: 'score', remainingAfter: 461 });
  });
});
