import { describe, expect, it } from 'vitest';
import { computeCalibration } from '../../src/voice/audio/calibrationMath';

const flat = (db: number, n = 50) => Array.from({ length: n }, () => db);

describe('Kalibrierung', () => {
  it('leise Stimme aus 3 m → mehr Verstärkung, Gate über dem Raum', () => {
    const r = computeCalibration(flat(-62), [...flat(-60, 30), ...flat(-38, 20)], 12);
    expect(r.gainDb).toBe(30); // 12 + 18
    expect(r.gateDb).toBeGreaterThan(-62 + 18);
    expect(r.gateDb).toBeLessThan(-20);
    expect(r.warning).toBeNull();
  });

  it('Verstärkung bleibt in 0–30 dB', () => {
    expect(computeCalibration(flat(-40), flat(-5), 10).gainDb).toBe(0);
    expect(computeCalibration(flat(-90), flat(-80), 10).gainDb).toBe(30);
  });

  it('warnt bei kaum Abstand zwischen Stimme und Raum', () => {
    expect(computeCalibration(flat(-40), flat(-36), 10).warning).toMatch(/kaum lauter/);
  });
});
