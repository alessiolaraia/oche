import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildGrammar,
  missingWords,
  parseCommand,
  soundAlikes,
  type ParseOptions,
} from '../../src/voice/commands';
import { FILLERS } from '../../src/voice/lexicon.de';
import { TRIGGER_SUGGESTIONS } from '../../src/voice/triggers';

const vocab = new Set(readFileSync('test/fixtures/vocab-subset.txt', 'utf8').split('\n').filter(Boolean));
const trigger: ParseOptions = { mode: 'trigger', trigger: 'wurf' };
const direct: ParseOptions = { ...trigger, mode: 'direct' };

describe('Befehle: nur „Trigger + Zahl“ und „Zurück“', () => {
  it.each([
    ['wurf sechzig', { type: 'score', value: 60 }],
    ['Wurf hundertachtzig', { type: 'score', value: 180 }],
    ['wurf hundert einundvierzig', { type: 'score', value: 141 }],
    ['wurf null', { type: 'score', value: 0 }],
    ['wurf nichts', { type: 'score', value: 0 }],
    ['wurf nix', { type: 'score', value: 0 }],
    ['wurf daneben', { type: 'score', value: 0 }],
    ['wurf zwo', { type: 'score', value: 2 }],
    ['wurf äh sechzig', { type: 'score', value: 60 }],
    ['wurf zurück', { type: 'undo' }],
  ])('„%s“', (text, cmd) => expect(parseCommand(text, trigger)).toEqual(cmd));

  it.each([
    'überworfen',
    'bust',
    'korrektur fünfundvierzig',
    'rest',
    'nein',
    'falsch',
    'pause',
    'weiter',
    'mikro aus',
    'neues leg',
    'check mit zwei',
    'stopp',
    'ja',
    'wurf triple zwanzig doppel zehn',
    'rückgängig',
  ])('frühere Befehle lösen nichts mehr aus: „%s“', (text) => {
    expect(parseCommand(text, trigger)).toBeNull();
  });

  it('„Zurück“ nur mit Triggerwort (Trigger-Modus) – Gerede wie „zurück“ löst nichts aus', () => {
    expect(parseCommand('zurück', trigger)).toBeNull();
    expect(parseCommand('zurück', direct)).toEqual({ type: 'undo' });
  });

  it('Ähnlich klingende Wörter landen als Ausweich-Phrase in der Grammatik, Beugungen des Triggers nicht', () => {
    const big = new Set([...vocab, 'abnahme', 'ausnahme', 'aufnahmen', 'aufnahme']);
    const s = soundAlikes('aufnahme', big);
    expect(s).toContain('abnahme');
    expect(s).toContain('ausnahme');
    expect(s).not.toContain('aufnahmen');
    expect(buildGrammar({ trigger: 'aufnahme', vocab: big })).toContain('abnahme');
  });

  it('Zahl ohne Triggerwort zählt nicht (Trigger-Modus), im Direkt-Modus schon', () => {
    expect(parseCommand('sechzig', trigger)).toBeNull();
    expect(parseCommand('ich hab sechzig', trigger)).toBeNull();
    expect(parseCommand('sechzig', direct)).toEqual({ type: 'score', value: 60 });
  });

  it('„sechs null“ wird nicht als 60 gewertet', () => {
    expect(parseCommand('wurf sechs null', trigger)).toBeNull();
  });

  it('jede Zahl 0–180 per „Wurf …“ und als Ziffern (Web Speech)', () => {
    for (let n = 0; n <= 180; n++)
      expect(parseCommand(`Wurf ${n}`, trigger)).toEqual({ type: 'score', value: n });
  });

  it('eigenes Triggerwort', () => {
    expect(parseCommand('treffer sechzig', { ...trigger, trigger: 'Treffer' })).toEqual({
      type: 'score',
      value: 60,
    });
    expect(parseCommand('wurf sechzig', { ...trigger, trigger: 'Treffer' })).toBeNull();
  });

  it('gelernte Aliase (z. B. „sehen“ → zehn)', () => {
    expect(parseCommand('wurf sehen', { ...trigger, aliases: { sehen: 'zehn' } })).toEqual({
      type: 'score',
      value: 10,
    });
    expect(parseCommand('wurf sehen', trigger)).toBeNull();
    expect(buildGrammar({ trigger: 'wurf', vocab: null, aliases: { sehen: 'zehn' } })).toContain('sehen');
  });

  it.each(TRIGGER_SUGGESTIONS)(
    'Grammatik mit Trigger „%s“: nur Vokabular-Wörter, keine alten Befehle',
    (t) => {
      const g = buildGrammar({ trigger: t, vocab });
      expect(missingWords(g, vocab)).toEqual([]);
      expect(g).toContain(`${t} sechzig`);
      expect(g).toContain(`${t} hundert einundvierzig`);
      expect(g).toContain('zurück');
      expect(g).toContain('[unk]');
      for (const old of ['überworfen', 'korrektur fünfundvierzig', 'pause', 'rest', 'nein', 'triple zwanzig'])
        expect(g).not.toContain(old);
    },
  );

  it('jede Grammatik-Phrase versteht der Parser (Direkt-Modus)', () => {
    const g = buildGrammar({ trigger: 'wurf', vocab });
    const ununderstood = g.filter(
      (p) => p !== '[unk]' && p !== 'wurf' && !FILLERS.includes(p) && parseCommand(p, direct) === null,
    );
    expect(ununderstood).toEqual([]);
  });
});
