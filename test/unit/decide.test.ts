import { describe, expect, it } from 'vitest';
import { decide, type DecideContext } from '../../src/voice/decide/decide';

const ctx: DecideContext = {
  mode: 'trigger',
  trigger: 'wurf',
  minConfidence: 0.55,
  triggerMinConfidence: 0.6,
  paused: false,
  echoMuted: false,
};
const t = (text: string, words: [string, number][]) => ({
  text,
  alternatives: [],
  confidence: words.reduce((s, [, c]) => s + c, 0) / words.length,
  words: words.map(([word, conf]) => ({ word, conf })),
});

describe('Entscheidung (S5–S6)', () => {
  it('sicher erkannt → angenommen', () => {
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 0.95],
          ['sechzig', 0.9],
        ]),
        ctx,
      ),
    ).toMatchObject({
      kind: 'accept',
      command: { type: 'score', value: 60 },
    });
  });

  it('Triggerwort unsicher → abgelehnt, ohne „nicht verstanden“-Ton (war wohl Gerede)', () => {
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 0.4],
          ['sechzig', 0.99],
        ]),
        ctx,
      ),
    ).toMatchObject({
      kind: 'reject',
      reason: 'lowTriggerConfidence',
      signal: false,
    });
  });

  it('Zahl unsicher → abgelehnt mit Ton', () => {
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 0.99],
          ['sechzig', 0.3],
        ]),
        ctx,
      ),
    ).toMatchObject({
      kind: 'reject',
      reason: 'lowConfidence',
      signal: true,
    });
  });

  it('eine sichere Zahl wird nicht von einem sicheren Trigger „hochgezogen“ und umgekehrt', () => {
    // Mittelwert wäre 0,64 ≥ 0,55 – trotzdem abgelehnt, weil die Zahl allein 0,3 hat
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 0.98],
          ['sechzig', 0.3],
        ]),
        ctx,
      ).kind,
    ).toBe('reject');
  });

  it('Echo und Pause', () => {
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 1],
          ['sechzig', 1],
        ]),
        { ...ctx, echoMuted: true },
      ),
    ).toMatchObject({
      reason: 'echo',
    });
    expect(
      decide(
        t('wurf sechzig', [
          ['wurf', 1],
          ['sechzig', 1],
        ]),
        { ...ctx, paused: true },
      ),
    ).toMatchObject({
      reason: 'paused',
    });
  });

  it('Gerede ohne Triggerwort → ignoriert, kein Ton', () => {
    expect(
      decide(
        t('sechzig leute', [
          ['sechzig', 0.9],
          ['leute', 0.9],
        ]),
        ctx,
      ),
    ).toMatchObject({
      kind: 'ignore',
      signal: false,
    });
  });
});

describe('Triggerwort mit Pause (S7)', () => {
  it('„Wurf“ allein wartet, danach zählt „sechzig“ ohne Trigger', () => {
    expect(decide(t('wurf', [['wurf', 0.9]]), ctx).kind).toBe('arm');
    expect(decide(t('sechzig', [['sechzig', 0.9]]), { ...ctx, armed: true })).toMatchObject({
      kind: 'accept',
      command: { type: 'score', value: 60 },
    });
    expect(decide(t('sechzig', [['sechzig', 0.9]]), ctx).kind).toBe('ignore');
  });
});
