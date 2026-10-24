import { describe, expect, it } from 'vitest';
import { energyProb, FRAME, VadGate } from '../../src/voice/audio/vadGate';

/** Strom aus Frames mit vorgegebener Wahrscheinlichkeit; Frame-Inhalt = Frame-Nummer (zum Nachverfolgen). */
async function run(probs: number[], o = {}) {
  const emitted: number[] = [];
  const events: string[] = [];
  let i = 0;
  const gate = new VadGate(
    () => probs[i++] ?? 0,
    {
      emit: (pcm) => emitted.push(pcm.length === FRAME ? pcm[0]! : -1),
      onSpeechStart: () => events.push('start'),
      onSpeechEnd: (d, kept) => events.push(kept ? `ende ${d}` : 'verworfen'),
    },
    o,
  );
  const pcm = new Float32Array(probs.length * FRAME);
  probs.forEach((_, k) => pcm.fill(k, k * FRAME, (k + 1) * FRAME));
  // in ungeraden Blockgrößen einspeisen
  for (let off = 0; off < pcm.length; off += 1600) await gate.push(pcm.slice(off, off + 1600));
  await gate.flush();
  return { emitted, events };
}

describe('VAD-Gate (S4)', () => {
  it('Sprache mit Pre-Roll, Ende nach Stille, danach Stille für Vosk', async () => {
    const probs = [...Array(20).fill(0), ...Array(15).fill(0.9), ...Array(15).fill(0)];
    const { emitted, events } = await run(probs);
    expect(events).toEqual(['start', expect.stringMatching(/^ende/)]);
    // Pre-Roll: 350 ms ≈ 11 Frames vor dem ersten Sprach-Frame (Frame 20)
    expect(emitted[0]).toBe(9);
    expect(emitted).toContain(20);
    expect(emitted.at(-1)).toBe(-1); // abschließende Stille
    expect(emitted).not.toContain(45); // nach dem Ende kommt nichts mehr
  });

  it('zu kurze Geräusche (Einschlag) werden verworfen', async () => {
    const probs = [...Array(10).fill(0), 0.9, 0.9, ...Array(20).fill(0)];
    const { emitted, events } = await run(probs);
    expect(events).toEqual(['start', 'verworfen']);
    expect(emitted).toEqual([]);
  });

  it('sehr lange Sprache wird nach max. 5 s geteilt', async () => {
    const { events } = await run(Array(400).fill(0.9));
    expect(events.filter((e) => e.startsWith('ende')).length).toBeGreaterThanOrEqual(2);
  });

  it('Energie-Fallback: laut über dem Rauschboden = Sprache', () => {
    const p = energyProb();
    const quiet = new Float32Array(FRAME).fill(0.001);
    const loud = new Float32Array(FRAME).map((_, i) => 0.3 * Math.sin(i / 3));
    for (let k = 0; k < 20; k++) p(quiet);
    expect(p(quiet)).toBeLessThan(0.2);
    expect(p(loud)).toBeGreaterThan(0.8);
  });
});
