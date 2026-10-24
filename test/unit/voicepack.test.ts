import { describe, expect, it } from 'vitest';
import type { FeedbackEvent } from '../../src/app/feedback';
import { announce } from '../../src/caller/announce';
import { packClips, scoreLevel, type PackLang } from '../../src/caller/voicepack';
import { reduce } from '../../src/engine/x01';
import type { MatchConfig, MatchEvent } from '../../src/engine/types';
import { DEFAULT_SETTINGS } from '../../src/settings/types';

const cfg: MatchConfig = {
  startScore: 501,
  inMode: 'straight',
  outMode: 'double',
  legs: { mode: 'firstTo', count: 3 },
  sets: null,
  players: [
    { id: 'a', name: 'Max' },
    { id: 'b', name: 'Lea' },
  ],
  startOrder: 'alternate',
};

describe('Klang-Paket', () => {
  it('Intensität steigt mit der Punktzahl', () => {
    expect([26, 60, 100, 140, 180].map(scoreLevel)).toEqual(['calm', 'normal', 'ton', 'big', 'max']);
  });

  it.each(['de', 'en'] as PackLang[])('%s: Schlüssel sind eindeutig, Texte nicht leer', (lang) => {
    const clips = packClips(lang);
    expect(new Set(clips.map((c) => c.key)).size).toBe(clips.length);
    for (const c of clips) expect(c.text.length).toBeGreaterThan(1);
  });

  it.each([
    ['plain', 'de'],
    ['arena', 'en'],
  ] as const)(
    '%s: jeder Clip-Schlüssel, den der Caller in einem Match nutzt, existiert im Paket',
    (style, lang) => {
      const keys = new Set(packClips(lang).map((c) => c.key));
      const caller = { ...DEFAULT_SETTINGS.caller, style, announceCheckoutRoute: false };
      const used = new Set<string>();
      let n = 0;
      const events: MatchEvent[] = [];
      const take = (e: FeedbackEvent, askingAny = false) =>
        announce(e, caller, { state: reduce(cfg, events), askingAny })?.cues.forEach(
          (c) => c.key && used.add(c.key),
        );
      // alle möglichen Aufnahmen aus allen Resten 2–501 (Stichprobe) + Bust/Checkout
      for (const score of [0, 26, 41, 45, 60, 81, 85, 100, 140, 171, 180]) {
        events.length = 0;
        events.push({ type: 'visit', id: String(++n), score, ts: n });
        const st = reduce(cfg, events);
        take({ type: 'visit', result: st.lastVisit!, state: st });
      }
      const leg: MatchEvent[] = [180, 0, 180, 0, 141].map((s) => ({
        type: 'visit',
        id: String(++n),
        score: s,
        ts: n,
      }));
      events.splice(0, events.length, ...leg);
      const st = reduce(cfg, events);
      take({ type: 'visit', result: st.lastVisit!, state: st }, true);
      take({ type: 'question', question: 'checkoutDarts' });
      take({ type: 'answered', question: 'checkoutDarts', value: 3 });
      take({ type: 'undo', state: st });
      take({ type: 'rejected', reason: 'impossible' });
      take({ type: 'matchStarted', state: st });
      take({ type: 'legRestarted', state: st });
      take({ type: 'control', action: 'pause' });
      take({ type: 'trainingTarget', mode: 'atc', target: 7, label: '7' });
      take({ type: 'trainingTarget', mode: 'checkout', target: 121, label: '121' });
      take({ type: 'trainingResult', success: true, darts: 9 });
      expect(used.size).toBeGreaterThan(10);
      expect([...used].filter((k) => !keys.has(k))).toEqual([]);
    },
  );
});

describe('Takes', () => {
  it('wählt bei mehreren Takes zufällig, fällt bei fehlender Datei auf den ersten zurück', async () => {
    const { variant } = await import('../../src/caller/packPlayer');
    const m = {
      id: 'x',
      lang: 'en' as const,
      name: '',
      license: '',
      format: 'm4a',
      clips: { score_180: 1, 'score_180~2': 1 },
      alts: { score_180: 3 },
    };
    expect(variant(m, 'score_180', () => 0)).toBe('score_180');
    expect(variant(m, 'score_180', () => 0.4)).toBe('score_180~2');
    expect(variant(m, 'score_180', () => 0.9)).toBe('score_180'); // ~3 fehlt
    expect(variant(m, 'score_60', () => 0.9)).toBe('score_60');
  });
});
