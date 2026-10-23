import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/engine/bot';
import { BOGEY_NUMBERS } from '../../src/engine/checkouts';
import { ATC_BULL, ATC_DONE, atcApply, atcLabel, atcStart, next121, randomCheckoutTarget } from '../../src/engine/training';

describe('Training', () => {
  it('Checkout-Ziele liegen in 2–170 und sind nie Bogeys', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 2000; i++) {
      const t = randomCheckoutTarget(rng);
      expect(t).toBeGreaterThanOrEqual(2);
      expect(t).toBeLessThanOrEqual(170);
      expect(BOGEY_NUMBERS).not.toContain(t);
    }
  });

  it('121: geschafft → höher, Bogeys werden übersprungen, nicht geschafft → gleich', () => {
    expect(next121(121, true)).toBe(122);
    expect(next121(121, false)).toBe(121);
    expect(next121(158, true)).toBe(160);
    expect(next121(170, true)).toBe(170);
  });

  it('Around the Clock', () => {
    let s = atcStart();
    s = atcApply(s, 3);
    expect(s).toEqual({ target: 4, darts: 3 });
    s = atcApply(s, 0);
    expect(s.darts).toBe(6);
    s = { target: 20, darts: 30 };
    s = atcApply(s, 1);
    expect(s.target).toBe(ATC_BULL);
    expect(atcLabel(s.target)).toBe('Bull');
    s = atcApply(s, 1);
    expect(s).toEqual({ target: ATC_DONE, darts: 34 });
    expect(atcApply(s, 3)).toEqual(s);
  });
});
