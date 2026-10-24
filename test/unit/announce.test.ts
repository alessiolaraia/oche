import { describe, expect, it } from 'vitest';
import type { FeedbackEvent } from '../../src/app/feedback';
import { announce } from '../../src/caller/announce';
import { numberToEnglish } from '../../src/caller/numbers.en';
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
let n = 0;
const v = (score: number, extra: object = {}): MatchEvent => ({
  type: 'visit',
  id: `v${++n}`,
  score,
  ts: n,
  ...extra,
});
const visitEvent = (events: MatchEvent[]): FeedbackEvent => {
  const state = reduce(cfg, events);
  return { type: 'visit', result: state.lastVisit!, state };
};
const plain = { ...DEFAULT_SETTINGS.caller, announceTurn: false };
const ctx = { state: null, askingAny: false };

describe('Ansagen', () => {
  it('Spielstart: „Max gegen Lea. Max beginnt. Spiel an!“', () => {
    const state = reduce(cfg, []);
    expect(announce({ type: 'matchStarted', state }, plain, ctx)?.text).toBe(
      'Max gegen Lea. Max beginnt. Spiel an!',
    );
    const arena = announce({ type: 'matchStarted', state }, { ...plain, style: 'arena' }, ctx)?.text;
    expect(arena).toBe('Max versus Lea. Max to throw first. Game on!');
  });

  it('Intro: Einschläge als Effekt, beim dritten „Hundertachtzig!“', () => {
    expect(announce({ type: 'introThrow', n: 1 }, plain, ctx)).toMatchObject({ text: '', sfx: 'whoosh' });
    expect(announce({ type: 'introDart', n: 3 }, plain, ctx)).toMatchObject({ text: '', sfx: 'thud' });
    expect(announce({ type: 'introMaximum' }, plain, ctx)).toMatchObject({
      text: 'Hundertachtzig!',
      sfx: 'maximum',
    });
  });

  it('Nüchtern: „Sechzig. Rest vierhunderteinundvierzig.“', () => {
    expect(announce(visitEvent([v(60)]), plain, ctx)?.text).toBe('Sechzig. Rest vierhunderteinundvierzig.');
  });

  it('wer dran ist + was er braucht', () => {
    const ev = [v(180), v(180), v(180), v(149)]; // Max 141, Lea 172 – Lea dran? nein: Max ist dran mit 141
    const a = announce(visitEvent(ev), { ...plain, announceTurn: true }, ctx);
    expect(a?.text).toBe(
      'Hundertneunundvierzig. Rest hundertzweiundsiebzig. Max, du bist dran. Du brauchst hunderteinundvierzig.',
    );
  });

  it('180 bekommt eine Spezialansage und Effekt', () => {
    const a = announce(visitEvent([v(180)]), plain, ctx);
    expect(a?.text).toBe('Hundertachtzig! Rest dreihunderteinundzwanzig.');
    expect(a?.sfx).toBe('maximum');
  });

  it('Bust', () => {
    const a = announce(visitEvent([v(180), v(0), v(180), v(0), v(150)]), plain, ctx);
    expect(a?.text).toBe('Überworfen. Rest hunderteinundvierzig.');
    expect(a?.sfx).toBe('bust');
  });

  it('Highfinish und Leg', () => {
    const a = announce(visitEvent([v(180), v(0), v(180), v(0), v(141)]), plain, { ...ctx, askingAny: true });
    expect(a?.text).toBe('Highfinish! Hunderteinundvierzig! Check! Leg für Max.');
    expect(a?.sfx).toBe('highFinish');
  });

  it('Arena: englischer Stil', () => {
    const arena = { ...plain, style: 'arena' as const, announceTurn: true };
    expect(announce(visitEvent([v(180)]), arena, ctx)?.text).toBe('One hundred and eighty!');
    const leg = announce(visitEvent([v(180), v(0), v(180), v(0), v(141)]), arena, {
      ...ctx,
      askingAny: true,
    });
    expect(leg?.text).toBe('What a finish! One hundred and forty-one! Game shot, and the first leg!');
  });

  it('englische Zahlen', () => {
    expect(numberToEnglish(121)).toBe('one hundred and twenty-one');
    expect(numberToEnglish(100)).toBe('one hundred');
    expect(numberToEnglish(501)).toBe('five hundred and one');
    expect(numberToEnglish(1001)).toBe('one thousand and one');
  });

  it('alles abschaltbar', () => {
    const off = { ...plain, enabled: false, sfx: false };
    expect(announce(visitEvent([v(180)]), off, ctx)).toBeNull();
    const sfxOnly = { ...plain, enabled: false };
    expect(announce(visitEvent([v(60)]), sfxOnly, ctx)).toEqual({
      cues: [],
      text: '',
      sfx: 'accept',
      interrupt: true,
    });
  });

  it('nicht verstanden → nur Ton', () => {
    expect(announce({ type: 'rejected', reason: 'notUnderstood' }, plain, ctx)).toEqual({
      cues: [],
      text: '',
      sfx: 'notUnderstood',
      interrupt: false,
    });
    expect(announce({ type: 'rejected', reason: 'impossible' }, plain, ctx)?.text).toBe('Nicht möglich.');
  });
});
