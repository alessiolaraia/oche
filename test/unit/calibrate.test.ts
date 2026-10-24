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

describe('Kalibrierung über Entfernung und Umgebung', async () => {
  const { presetCalibration } = await import('../../src/voice/audio/calibrationMath');

  it('weiter weg → mehr Verstärkung (bis maximal 30 dB)', () => {
    const near = presetCalibration(0.5, 'medium');
    const mid = presetCalibration(2.5, 'medium');
    const far = presetCalibration(6, 'medium');
    expect(near.gainDb).toBe(6);
    expect(mid.gainDb).toBeGreaterThan(near.gainDb);
    expect(mid.gainDb).toBe(20);
    expect(far.gainDb).toBeLessThanOrEqual(30);
  });

  it('lautere Umgebung → höheres Gate und strengere Erkennung', () => {
    const quiet = presetCalibration(2.5, 'veryQuiet');
    const loud = presetCalibration(2.5, 'veryLoud');
    expect(loud.gateDb).toBeGreaterThan(quiet.gateDb);
    expect(loud.minConfidence).toBeGreaterThan(quiet.minConfidence);
  });

  it('Gate liegt immer unter dem Sprachpegel (−20 dBFS nach Verstärkung)', () => {
    for (const d of [0.5, 1, 2, 2.5, 3, 4])
      for (const env of ['veryQuiet', 'quiet', 'medium', 'loud', 'veryLoud'] as const)
        expect(presetCalibration(d, env).gateDb).toBeLessThan(-20);
  });
});
