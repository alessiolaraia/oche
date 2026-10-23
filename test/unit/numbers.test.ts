import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  numberPhrases,
  numberToWords,
  parseNumberAt,
  spokenForms,
  tokenize,
  wordUnder100,
} from '../../src/voice/numbers.de';

const vocab = new Set(readFileSync('test/fixtures/vocab-subset.txt', 'utf8').split('\n').filter(Boolean));

function parseWhole(text: string): number | null {
  const t = tokenize(text);
  const p = parseNumberAt(t, 0);
  return p && p.next === t.length ? p.value : null;
}

describe('Zahlwörter', () => {
  it.each([
    [0, 'null'],
    [1, 'eins'],
    [16, 'sechzehn'],
    [17, 'siebzehn'],
    [21, 'einundzwanzig'],
    [30, 'dreißig'],
    [41, 'einundvierzig'],
    [60, 'sechzig'],
    [77, 'siebenundsiebzig'],
    [99, 'neunundneunzig'],
  ])('%i → %s', (n, w) => expect(wordUnder100(n)).toBe(w));

  it.each([
    [100, 'hundert'],
    [101, 'hunderteins'],
    [121, 'hunderteinundzwanzig'],
    [180, 'hundertachtzig'],
    [441, 'vierhunderteinundvierzig'],
    [501, 'fünfhunderteins'],
    [170, 'hundertsiebzig'],
  ])('kanonisch %i → %s', (n, w) => expect(numberToWords(n)).toBe(w));

  it('alle 0–180 in allen Schreibweisen werden zurückgelesen', () => {
    for (let n = 0; n <= 180; n++) {
      for (const form of spokenForms(n)) expect(parseWhole(form.join(' ')), form.join(' ')).toBe(n);
      expect(parseWhole(String(n)), `Ziffern ${n}`).toBe(n);
      expect(parseWhole(numberToWords(n))).toBe(n);
    }
  });

  it.each([
    ['hunderteinundvierzig', 141],
    ['hundert einundvierzig', 141],
    ['einhundertvierzig', 140],
    ['ein hundert vierzig', 140],
    ['hundert und vierzig', 140],
    ['Hundert-Einundvierzig', 141],
    ['sechzig', 60],
    ['einhundert', 100],
  ])('„%s“ → %i', (text, n) => expect(parseWhole(text)).toBe(n));

  it('„sechs null“ ist NICHT 60', () => {
    expect(parseWhole('sechs null')).toBeNull();
    const t = tokenize('sechs null');
    expect(parseNumberAt(t, 0)).toEqual({ value: 6, next: 1 });
  });

  it('„hundert null“ ist keine Zahl', () => {
    expect(parseWhole('hundert null')).toBeNull();
  });

  it('[unk] und Satzzeichen werden entfernt', () => {
    expect(tokenize('[unk] Wurf, sechzig!')).toEqual(['wurf', 'sechzig']);
  });

  it('Grammatik-Zahlen nur aus Wörtern im Modellvokabular, jede Zahl 0–180 abgedeckt', () => {
    const phrases = numberPhrases(0, 180, vocab);
    for (const p of phrases) for (const w of p.split(' ')) expect(vocab.has(w), w).toBe(true);
    const covered = new Set(phrases.map((p) => parseWhole(p)));
    for (let n = 0; n <= 180; n++) expect(covered.has(n), `${n} sagbar`).toBe(true);
    expect(phrases).toContain('hundert einundvierzig');
    expect(phrases).not.toContain('hunderteinundvierzig'); // nicht im Modell
    expect(phrases).toContain('hundertachtzig'); // im Modell
  });
});
