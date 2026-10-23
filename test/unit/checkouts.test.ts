import { describe, expect, it } from 'vitest';
import {
  ALL_DARTS,
  BOGEY_NUMBERS,
  checkoutRoute,
  dartValue,
  formatRoute,
  isFinishable,
  isFinishingDart,
} from '../../src/engine/checkouts';
import type { OutMode } from '../../src/engine/types';

/** Brute force: alle Reste, die mit ≤ n Darts checkbar sind. */
function bruteForceFinishable(out: OutMode, n: number): Set<number> {
  const finishers = ALL_DARTS.filter((d) => isFinishingDart(d, out)).map(dartValue);
  const any = [0, ...ALL_DARTS.map(dartValue)];
  const set = new Set<number>();
  for (const f of finishers)
    for (const a of n >= 2 ? any : [0]) for (const b of n >= 3 ? any : [0]) set.add(f + a + b);
  return set;
}

describe('Checkout-Tabelle', () => {
  it.each([
    [170, 'T20 T20 Bull'],
    [167, 'T20 T19 Bull'],
    [121, 'T20 T11 D14'],
    [100, 'T20 D20'],
    [40, 'D20'],
    [32, 'D16'],
    [2, 'D1'],
    [3, 'S1 D1'],
    [41, 'S9 D16'],
  ])('%i → %s', (rest, route) => {
    expect(formatRoute(checkoutRoute(rest, 'double')!)).toBe(route);
  });

  it('jeder Weg 2–170 summiert korrekt, endet auf Doppel/Bull und hat ≤ 3 Darts', () => {
    for (let rest = 2; rest <= 170; rest++) {
      const route = checkoutRoute(rest, 'double');
      if (BOGEY_NUMBERS.includes(rest)) {
        expect(route, `Bogey ${rest}`).toBeNull();
        continue;
      }
      expect(route, `Rest ${rest}`).not.toBeNull();
      expect(route!.length).toBeLessThanOrEqual(3);
      expect(route!.reduce((s, d) => s + dartValue(d), 0)).toBe(rest);
      expect(route!.at(-1)!.multiplier).toBe(2);
    }
  });

  it('Bogey-Liste stimmt mit Brute-Force überein', () => {
    const ok = bruteForceFinishable('double', 3);
    const bogeys = Array.from({ length: 169 }, (_, i) => i + 2).filter((r) => !ok.has(r));
    expect(bogeys).toEqual([...BOGEY_NUMBERS]);
  });

  it.each(['double', 'master', 'straight'] as const)('isFinishable == Brute-Force (%s, 1–3 Darts)', (out) => {
    for (const n of [1, 2, 3]) {
      const ok = bruteForceFinishable(out, n);
      for (let rest = 1; rest <= 181; rest++) {
        expect(isFinishable(rest, out, n), `${out} ${rest} mit ${n}`).toBe(ok.has(rest));
      }
    }
  });

  it('weniger Darts: 2 Darts übrig für 100 → T20 D20, für 101 → T17 Bull, 1 Dart für 50 → Bull', () => {
    expect(formatRoute(checkoutRoute(100, 'double', 2)!)).toBe('T20 D20');
    expect(formatRoute(checkoutRoute(101, 'double', 2)!)).toBe('T17 Bull');
    expect(formatRoute(checkoutRoute(50, 'double', 1)!)).toBe('Bull');
    expect(checkoutRoute(120, 'double', 2)).toBeNull();
  });

  it('Rest 1 ist bei Double-Out nie checkbar', () => {
    expect(checkoutRoute(1, 'double')).toBeNull();
    expect(formatRoute(checkoutRoute(1, 'straight')!)).toBe('S1');
  });

  it('Master-Out 180 → T20 T20 T20', () => {
    expect(formatRoute(checkoutRoute(180, 'master')!)).toBe('T20 T20 T20');
  });
});
