import { BULL } from '../engine/checkouts';
import type { Dart, Multiplier } from '../engine/types';
import { numberPhrases, parseNumberAt, tokenize, wordUnder100 } from './numbers.de';

export type Command =
  | { type: 'score'; value: number }
  | { type: 'darts'; darts: Dart[] }
  | { type: 'bust' }
  | { type: 'undo' }
  | { type: 'reject' }
  | { type: 'correct'; value: number }
  | { type: 'remaining' }
  | { type: 'checkoutDarts'; value: number }
  | { type: 'answer'; value: number }
  | { type: 'newLeg' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'micOff' };

export interface ParseOptions {
  mode: 'trigger' | 'direct';
  trigger: string;
  singleDarts: boolean;
  /** Eine Nachfrage („Mit wie vielen Darts?“) ist offen → bloße Zahl 0–3 ist die Antwort. */
  awaitingAnswer: boolean;
}

/** Feste Befehle (Wortfolge → Befehl). Erlaubt mit und ohne Triggerwort. */
const FIXED: ReadonlyArray<[string, Command]> = [
  ['überworfen', { type: 'bust' }],
  ['überwurf', { type: 'bust' }],
  ['bust', { type: 'bust' }],
  ['zurück', { type: 'undo' }],
  ['rückgängig', { type: 'undo' }],
  ['nein', { type: 'reject' }],
  ['falsch', { type: 'reject' }],
  ['rest', { type: 'remaining' }],
  ['neues leg', { type: 'newLeg' }],
  ['pause', { type: 'pause' }],
  ['weiter', { type: 'resume' }],
  ['mikro aus', { type: 'micOff' }],
  ['mikrofon aus', { type: 'micOff' }],
];

const ZERO_WORDS = ['null', 'nichts'];
const CHECKOUT_LEAD = ['check', 'aus', 'finish'];
const DARTS_WORDS = ['darts', 'dart'];

const MULTIPLIER_WORDS: Record<string, Multiplier> = {
  triple: 3,
  dreifach: 3,
  doppel: 2,
  doppelt: 2,
  double: 2,
  single: 1,
  einfach: 1,
};
const MISS_WORDS = ['daneben', 'vorbei', 'miss'];

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Liest eine Zahl, die die Tokens ab `i` vollständig ausfüllt. */
function wholeNumber(tokens: readonly string[], i = 0): number | null {
  const p = parseNumberAt(tokens, i);
  return p && p.next === tokens.length ? p.value : null;
}

/** „triple zwanzig doppel zehn single fünf“, „bull“, „daneben“ … */
export function parseDarts(tokens: readonly string[]): Dart[] | null {
  const darts: Dart[] = [];
  let explicit = false;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (MISS_WORDS.includes(t)) {
      darts.push({ segment: 0, multiplier: 1 });
      explicit = true;
      i++;
      continue;
    }
    let mult: Multiplier = 1;
    const m = MULTIPLIER_WORDS[t];
    if (m) {
      mult = m;
      explicit = true;
      i++;
    }
    if (tokens[i] === 'bull') {
      darts.push({ segment: BULL, multiplier: mult === 1 && m ? 1 : 2 });
      explicit = true;
      i++;
      continue;
    }
    const p = parseNumberAt(tokens, i);
    if (!p) return null;
    if (p.value === 25 && mult !== 3) darts.push({ segment: BULL, multiplier: mult === 2 ? 2 : 1 });
    else if (p.value === 50 && mult === 1 && !m) darts.push({ segment: BULL, multiplier: 2 });
    else if (p.value >= 1 && p.value <= 20) darts.push({ segment: p.value, multiplier: mult });
    else return null;
    i = p.next;
  }
  // ohne Multiplikator/Bull/Daneben wäre es eine normale Zahl → kein Einzeldart-Befehl
  if (!explicit || darts.length === 0 || darts.length > 3) return null;
  return darts;
}

export function parseCommand(text: string, opts: ParseOptions): Command | null {
  const all = tokenize(text);
  if (all.length === 0) return null;
  const trigger = opts.trigger.toLowerCase();
  const hasTrigger = all[0] === trigger;
  const t = hasTrigger ? all.slice(1) : all;
  if (t.length === 0) return null;

  for (const [phrase, cmd] of FIXED) if (same(t, phrase.split(' '))) return cmd;

  // „Korrektur fünfundvierzig“
  if (t[0] === 'korrektur') {
    const v = wholeNumber(t, 1);
    if (v !== null) return { type: 'correct', value: v };
    if (t.length === 2 && ZERO_WORDS.includes(t[1]!)) return { type: 'correct', value: 0 };
    return null;
  }

  // „Check mit zwei“ / „Aus mit drei“ / „mit zwei“ / „zwei Darts“
  if (CHECKOUT_LEAD.includes(t[0]!) && t[1] === 'mit') {
    const v = wholeNumber(t, 2);
    return v !== null && v >= 1 && v <= 3 ? { type: 'checkoutDarts', value: v } : null;
  }
  if (t[0] === 'mit') {
    const v = wholeNumber(t, 1);
    return v !== null && v >= 0 && v <= 3
      ? { type: opts.awaitingAnswer ? 'answer' : 'checkoutDarts', value: v }
      : null;
  }
  if (t.length >= 2 && DARTS_WORDS.includes(t.at(-1)!)) {
    const v = wholeNumber(t.slice(0, -1));
    if (v !== null && v >= 0 && v <= 3)
      return { type: opts.awaitingAnswer ? 'answer' : 'checkoutDarts', value: v };
  }

  // offene Nachfrage: bloße Zahl 0–3 beantwortet sie (auch im Trigger-Modus)
  if (opts.awaitingAnswer && !hasTrigger) {
    const v = wholeNumber(t);
    if (v !== null && v >= 0 && v <= 3) return { type: 'answer', value: v };
  }

  const scoringAllowed = hasTrigger || opts.mode === 'direct';
  if (!scoringAllowed) return null;

  if (t.length === 1 && ZERO_WORDS.includes(t[0]!)) return { type: 'score', value: 0 };
  const v = wholeNumber(t);
  if (v !== null) return { type: 'score', value: v };

  if (opts.singleDarts) {
    const darts = parseDarts(t);
    if (darts) return { type: 'darts', darts };
  }
  return null;
}

export interface GrammarOptions {
  trigger: string;
  singleDarts: boolean;
  vocab: ReadonlySet<string> | null;
}

/** Vosk-Grammatik: alle erlaubten Phrasen, nur aus Wörtern im Modellvokabular. */
export function buildGrammar(opts: GrammarOptions): string[] {
  const has = (phrase: string) => !opts.vocab || phrase.split(' ').every((w) => opts.vocab!.has(w));
  const trigger = opts.trigger.toLowerCase();
  const numbers = numberPhrases(0, 180, opts.vocab);
  const phrases = new Set<string>();

  for (const n of numbers) {
    phrases.add(n);
    phrases.add(`${trigger} ${n}`);
    phrases.add(`korrektur ${n}`);
  }
  for (const z of ZERO_WORDS) phrases.add(`${trigger} ${z}`);
  phrases.add('korrektur nichts');
  for (const [p] of FIXED) {
    phrases.add(p);
    phrases.add(`${trigger} ${p}`);
  }
  for (const lead of CHECKOUT_LEAD)
    for (const n of ['eins', 'zwei', 'drei', 'einem']) phrases.add(`${lead} mit ${n}`);
  for (const n of ['null', 'eins', 'zwei', 'drei', 'einem', 'einen']) phrases.add(`mit ${n}`);
  for (const n of ['null', 'ein', 'einen', 'zwei', 'drei']) phrases.add(`${n} darts`);

  if (opts.singleDarts) {
    const dartPhrases: string[] = [...MISS_WORDS, 'bull'];
    for (const mw of Object.keys(MULTIPLIER_WORDS)) {
      for (let s = 1; s <= 20; s++) dartPhrases.push(`${mw} ${wordUnder100(s)}`);
      dartPhrases.push(`${mw} bull`);
    }
    for (const d of dartPhrases) phrases.add(d);
    // Triggerwort allein, damit „Wurf triple zwanzig, doppel zehn …“ als Folge erkannt wird
    phrases.add(trigger);
  }
  return [...phrases].filter(has).concat('[unk]');
}

/** Wörter der Grammatik, die nicht im Modellvokabular stehen (für Warnungen im UI). */
export function missingWords(phrases: readonly string[], vocab: ReadonlySet<string>): string[] {
  const missing = new Set<string>();
  for (const p of phrases) for (const w of p.split(' ')) if (w !== '[unk]' && !vocab.has(w)) missing.add(w);
  return [...missing];
}
