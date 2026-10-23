import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildGrammar,
  missingWords,
  parseCommand,
  parseDarts,
  type ParseOptions,
} from '../../src/voice/commands';
import { tokenize } from '../../src/voice/numbers.de';
import { TRIGGER_SUGGESTIONS } from '../../src/voice/triggers';

const vocab = new Set(readFileSync('test/fixtures/vocab-subset.txt', 'utf8').split('\n').filter(Boolean));
const trigger: ParseOptions = { mode: 'trigger', trigger: 'wurf', singleDarts: true, awaitingAnswer: false };
const direct: ParseOptions = { ...trigger, mode: 'direct' };

describe('Befehle', () => {
  it.each([
    ['wurf sechzig', { type: 'score', value: 60 }],
    ['Wurf hundertachtzig', { type: 'score', value: 180 }],
    ['wurf hundert einundvierzig', { type: 'score', value: 141 }],
    ['wurf null', { type: 'score', value: 0 }],
    ['wurf nichts', { type: 'score', value: 0 }],
    ['überworfen', { type: 'bust' }],
    ['wurf überworfen', { type: 'bust' }],
    ['bust', { type: 'bust' }],
    ['zurück', { type: 'undo' }],
    ['rückgängig', { type: 'undo' }],
    ['korrektur fünfundvierzig', { type: 'correct', value: 45 }],
    ['nein', { type: 'reject' }],
    ['falsch', { type: 'reject' }],
    ['rest', { type: 'remaining' }],
    ['check mit zwei', { type: 'checkoutDarts', value: 2 }],
    ['aus mit drei', { type: 'checkoutDarts', value: 3 }],
    ['neues leg', { type: 'newLeg' }],
    ['pause', { type: 'pause' }],
    ['weiter', { type: 'resume' }],
    ['mikro aus', { type: 'micOff' }],
  ])('Trigger-Modus: „%s“', (text, cmd) => expect(parseCommand(text, trigger)).toEqual(cmd));

  it('Trigger-Modus: Zahl ohne Triggerwort zählt nicht', () => {
    expect(parseCommand('sechzig', trigger)).toBeNull();
    expect(parseCommand('ich hab sechzig', trigger)).toBeNull();
  });

  it('Direkt-Modus: Zahl allein reicht', () => {
    expect(parseCommand('sechzig', direct)).toEqual({ type: 'score', value: 60 });
    expect(parseCommand('wurf sechzig', direct)).toEqual({ type: 'score', value: 60 });
  });

  it('„sechs null“ wird nicht als 60 gewertet', () => {
    expect(parseCommand('wurf sechs null', trigger)).toBeNull();
    expect(parseCommand('sechs null', direct)).toBeNull();
  });

  it('jede Zahl 0–180 per „Wurf …“ und als Ziffern (Web Speech)', () => {
    for (let n = 0; n <= 180; n++)
      expect(parseCommand(`Wurf ${n}`, trigger)).toEqual({ type: 'score', value: n });
  });

  it('Nachfrage offen: bloße Zahl 0–3 ist die Antwort', () => {
    const o = { ...trigger, awaitingAnswer: true };
    expect(parseCommand('zwei', o)).toEqual({ type: 'answer', value: 2 });
    expect(parseCommand('mit drei', o)).toEqual({ type: 'answer', value: 3 });
    expect(parseCommand('zwei darts', o)).toEqual({ type: 'answer', value: 2 });
    expect(parseCommand('wurf sechzig', o)).toEqual({ type: 'score', value: 60 });
    expect(parseCommand('zwei', trigger)).toBeNull();
  });

  it('Einzeldarts', () => {
    expect(parseCommand('wurf triple zwanzig doppel zehn single fünf', trigger)).toEqual({
      type: 'darts',
      darts: [
        { segment: 20, multiplier: 3 },
        { segment: 10, multiplier: 2 },
        { segment: 5, multiplier: 1 },
      ],
    });
    expect(parseDarts(tokenize('bull'))).toEqual([{ segment: 25, multiplier: 2 }]);
    expect(parseDarts(tokenize('single bull'))).toEqual([{ segment: 25, multiplier: 1 }]);
    expect(parseDarts(tokenize('triple zwanzig daneben'))).toEqual([
      { segment: 20, multiplier: 3 },
      { segment: 0, multiplier: 1 },
    ]);
    expect(parseDarts(tokenize('triple einundzwanzig'))).toBeNull();
    expect(parseDarts(tokenize('zwanzig'))).toBeNull(); // ohne Multiplikator = normale Zahl
    expect(parseCommand('triple zwanzig', trigger)).toBeNull(); // Trigger nötig
  });

  it('Unsinn → null', () => {
    expect(parseCommand('', trigger)).toBeNull();
    expect(parseCommand('[unk]', trigger)).toBeNull();
    expect(parseCommand('wurf', trigger)).toBeNull();
    expect(parseCommand('wurf banane', trigger)).toBeNull();
    expect(parseCommand('korrektur', trigger)).toBeNull();
  });

  it('anderes Triggerwort', () => {
    expect(parseCommand('treffer sechzig', { ...trigger, trigger: 'Treffer' })).toEqual({
      type: 'score',
      value: 60,
    });
  });

  it.each(TRIGGER_SUGGESTIONS)('Grammatik mit Trigger „%s“ nutzt nur Vokabular-Wörter', (t) => {
    const g = buildGrammar({ trigger: t, singleDarts: true, vocab });
    expect(missingWords(g, vocab)).toEqual([]);
    expect(g).toContain(`${t} sechzig`);
    expect(g).toContain(`${t} hundert einundvierzig`);
    expect(g).toContain('[unk]');
    expect(g).not.toContain('bust');
  });

  it('jede Grammatik-Phrase wird vom Parser verstanden (Direkt-Modus, Darts an)', () => {
    const g = buildGrammar({ trigger: 'wurf', singleDarts: true, vocab });
    const ununderstood = g.filter(
      (p) => p !== '[unk]' && p !== 'wurf' && parseCommand(p, { ...direct, awaitingAnswer: true }) === null,
    );
    expect(ununderstood).toEqual([]);
  });
});
