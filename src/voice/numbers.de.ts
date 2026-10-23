// EINZIGE Quelle für deutsche Zahlwörter 0–180: Grammatik (Vosk), Parser und Ansagen nutzen diese Datei.

const UNITS = [
  'null',
  'eins',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
/** Einer als Präfix in Komposita: „ein“undzwanzig, nicht „eins“undzwanzig. */
const ONES_PREFIX = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];

export const HUNDRED_WORDS = ['hundert', 'einhundert'] as const;
export const MAX_SCORE_WORD = 180;

/** 0–99 als ein Wort: 41 → „einundvierzig“. */
export function wordUnder100(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError(`${n}`);
  if (n < 20) return UNITS[n]!;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t]! : `${ONES_PREFIX[o]}und${TENS[t]}`;
}

/** Kanonische Schreibweise 0–999 (für Ansagen): 141 → „hunderteinundvierzig“, 441 → „vierhunderteinundvierzig“. */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new RangeError(`${n}`);
  if (n < 100) return wordUnder100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 1 ? 'hundert' : `${ONES_PREFIX[h]}hundert`;
  return r === 0 ? head : head + wordUnder100(r);
}

/**
 * Alle Wortfolgen, mit denen `n` (0–199) gesagt werden kann.
 * Bewusst NICHT: „sechs null“ (wäre zwei Zahlen) oder „hundert und …“ als Zahl > 199.
 */
export function spokenForms(n: number): string[][] {
  if (n < 100) return [[wordUnder100(n)]];
  if (n === 100) return [['hundert'], ['einhundert'], ['ein', 'hundert']];
  const r = wordUnder100(n - 100);
  return [
    [`hundert${r}`],
    [`einhundert${r}`],
    ['hundert', r],
    ['einhundert', r],
    ['ein', 'hundert', r],
    ['hundert', 'und', r],
  ];
}

const SINGLE_TOKEN = new Map<string, number>();
for (let n = 0; n <= 199; n++) {
  for (const form of spokenForms(n)) if (form.length === 1) SINGLE_TOKEN.set(form[0]!, n);
}
// Varianten, die Erkenner gern ausgeben
SINGLE_TOKEN.set('eine', 1);
SINGLE_TOKEN.set('ein', 1);
SINGLE_TOKEN.set('einen', 1);
SINGLE_TOKEN.set('einem', 1);

export interface ParsedNumber {
  value: number;
  /** Index des ersten Tokens nach der Zahl. */
  next: number;
}

/** Liest genau eine Zahl ab Position `i` (Wörter oder Ziffern). */
export function parseNumberAt(tokens: readonly string[], i: number): ParsedNumber | null {
  const t = tokens[i];
  if (t === undefined) return null;
  if (/^\d{1,3}$/.test(t)) return { value: Number(t), next: i + 1 };

  // „ein hundert …“
  if (t === 'ein' && tokens[i + 1] === 'hundert') return hundredTail(tokens, i + 2);
  if (t === 'hundert' || t === 'einhundert') return hundredTail(tokens, i + 1);

  const v = SINGLE_TOKEN.get(t);
  return v === undefined ? null : { value: v, next: i + 1 };
}

function hundredTail(tokens: readonly string[], j: number): ParsedNumber {
  let k = j;
  if (tokens[k] === 'und') k++;
  const tail = tokens[k];
  const r = tail === undefined ? undefined : /^\d{1,2}$/.test(tail) ? Number(tail) : SINGLE_TOKEN.get(tail);
  if (r !== undefined && r >= 1 && r <= 99 && !(tail === 'null')) return { value: 100 + r, next: k + 1 };
  return { value: 100, next: j };
}

/** Text → Tokens: klein, ohne Satzzeichen, Bindestriche trennen. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:„“"'()]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t !== '[unk]');
}

/**
 * Wortfolgen aller Zahlen von `from` bis `to`, die vollständig im Modellvokabular liegen
 * (ohne Vokabular: alle).
 */
export function numberPhrases(from: number, to: number, vocab: ReadonlySet<string> | null): string[] {
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    for (const form of spokenForms(n)) {
      if (form[0] === 'ein' && form[1] === 'hundert') continue; // in Vosk-Grammatik redundant
      if (form.includes('und') && form.length === 3) continue; // „hundert und x“ nur für den Parser
      if (!vocab || form.every((w) => vocab.has(w))) out.push(form.join(' '));
    }
  }
  return out;
}
