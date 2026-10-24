// Sprachbefehle – bewusst nur zwei: „[Triggerwort] Zahl“ und „Zurück“.
// Weniger Befehle = kleinere Grammatik = seltener versehentlich ausgelöst.
import { BUILTIN_ALIASES, FILLERS, normalizeTokens, UNDO_WORDS, ZERO_WORDS } from './lexicon.de';
import { numberPhrases, parseNumberAt, tokenize } from './numbers.de';

export type Command = { type: 'score'; value: number } | { type: 'undo' };

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

  // „Zurück“ – mit oder ohne Triggerwort
  if (t.length === 1 && UNDO_WORDS.includes(t[0]!)) return { type: 'undo' };

  if (!hasTrigger && opts.mode !== 'direct') return null;
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
  for (const u of UNDO_WORDS) phrases.add(u);
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
