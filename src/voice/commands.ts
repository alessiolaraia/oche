// Sprachbefehle – bewusst nur zwei: „[Triggerwort] Zahl“ und „Zurück“.
// Weniger Befehle = kleinere Grammatik = seltener versehentlich ausgelöst.
import { BUILTIN_ALIASES, FILLERS, normalizeTokens, UNDO_WORDS, ZERO_WORDS } from './lexicon.de';
import { numberPhrases, parseNumberAt, tokenize } from './numbers.de';

export type Command = { type: 'score'; value: number } | { type: 'undo' };

/** Untergrenze für die Sicherheit des Triggerworts – auch wenn ältere Einstellungen weniger erlauben. */
export const TRIGGER_MIN_CONFIDENCE = 0.72;

export interface ParseOptions {
  mode: 'trigger' | 'direct';
  trigger: string;
  /** Gelernte Aliase des Nutzers. */
  aliases?: Readonly<Record<string, string>>;
}

/** Liest eine Zahl, die die Tokens ab `i` vollständig ausfüllt. */
function wholeNumber(tokens: readonly string[], i = 0): number | null {
  const p = parseNumberAt(tokens, i);
  return p && p.next === tokens.length ? p.value : null;
}

export function parseCommand(text: string, opts: ParseOptions): Command | null {
  const all = normalizeTokens(tokenize(text), opts.aliases);
  if (all.length === 0) return null;
  const trigger = opts.trigger.toLowerCase();
  const hasTrigger = all[0] === trigger;
  const t = hasTrigger ? all.slice(1) : all;
  if (t.length === 0) return null;

  // Ohne Triggerwort passiert nichts (im Trigger-Modus) – auch kein „Zurück“
  if (!hasTrigger && opts.mode !== 'direct') return null;
  if (t.length === 1 && UNDO_WORDS.includes(t[0]!)) return { type: 'undo' };
  if (t.length === 1 && ZERO_WORDS.includes(t[0]!)) return { type: 'score', value: 0 };
  const v = wholeNumber(t);
  return v !== null ? { type: 'score', value: v } : null;
}

export interface GrammarOptions {
  trigger: string;
  vocab: ReadonlySet<string> | null;
  /** Gelernte Aliase – ihre Wörter kommen als eigene Phrasen in die Grammatik. */
  aliases?: Readonly<Record<string, string>>;
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}

/** Wörter aus dem Vokabular, die dem Triggerwort ähneln (höchstens 12, die ähnlichsten zuerst). */
export function soundAlikes(trigger: string, vocab: ReadonlySet<string> | null, max = 12): string[] {
  if (!vocab) return [];
  const t = trigger.toLowerCase();
  const limit = t.length >= 6 ? 2 : 1;
  const numbers = new Set(numberPhrases(0, 180, null).flatMap((p) => p.split(' ')));
  const found: [string, number][] = [];
  for (const w of vocab) {
    if (w === t || numbers.has(w) || Math.abs(w.length - t.length) > limit) continue;
    // Beugungen des Triggerworts selbst („Aufnahmen“, „Wurfs“) klingen gleich – die nicht wegnehmen
    if (w.startsWith(t) || t.startsWith(w)) continue;
    const d = editDistance(w, t);
    if (d <= limit) found.push([w, d]);
  }
  return found
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

/** Vosk-Grammatik: alle erlaubten Phrasen, nur aus Wörtern im Modellvokabular. */
export function buildGrammar(opts: GrammarOptions): string[] {
  const has = (phrase: string) => !opts.vocab || phrase.split(' ').every((w) => opts.vocab!.has(w));
  const trigger = opts.trigger.toLowerCase();
  const phrases = new Set<string>();
  for (const n of numberPhrases(0, 180, opts.vocab)) {
    // Zahlen auch ohne Trigger: Gerede wie „sechzig Leute“ landet dort statt in „Wurf sechzig“
    phrases.add(n);
    phrases.add(`${trigger} ${n}`);
  }
  for (const z of ZERO_WORDS) phrases.add(`${trigger} ${z}`);
  for (const alias of Object.keys(BUILTIN_ALIASES)) {
    phrases.add(alias);
    phrases.add(`${trigger} ${alias}`);
  }
  for (const u of UNDO_WORDS) {
    phrases.add(`${trigger} ${u}`);
    phrases.add(u); // allein: fängt Gerede ab, löst aber nichts aus
  }
  // Ähnlich klingende Wörter als Ausweich-Phrasen: „Abnahme“ wird dann nicht zu „Aufnahme“ gepresst
  for (const w of soundAlikes(trigger, opts.vocab)) phrases.add(w);
  for (const f of FILLERS) phrases.add(f);
  for (const learned of opts.aliases ? Object.keys(opts.aliases) : []) phrases.add(learned);
  // Triggerwort allein: „Wurf … (Pause) … sechzig“
  phrases.add(trigger);
  return [...phrases].filter(has).concat('[unk]');
}

/** Wörter der Grammatik, die nicht im Modellvokabular stehen (für Warnungen im UI). */
export function missingWords(phrases: readonly string[], vocab: ReadonlySet<string>): string[] {
  const missing = new Set<string>();
  for (const p of phrases) for (const w of p.split(' ')) if (w !== '[unk]' && !vocab.has(w)) missing.add(w);
  return [...missing];
}
