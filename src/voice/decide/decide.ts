// Entscheidung über ein Erkennungsergebnis – rein, ohne Seiteneffekte.
// Wird von der App (control.ts) und vom Eval-Runner identisch benutzt.
import { parseCommand, type Command } from '../commands';
import type { Transcript } from '../engine';
import { parseNumberAt, tokenize } from '../numbers.de';

export interface DecideContext {
  mode: 'trigger' | 'direct';
  trigger: string;
  aliases?: Readonly<Record<string, string>>;
  minConfidence: number;
  /** Strengere Schwelle für das Triggerwort (0 = aus). */
  triggerMinConfidence: number;
  paused: boolean;
  echoMuted: boolean;
  /** Triggerwort wurde kurz zuvor allein gesagt („Wurf … sechzig“) – die Zahl zählt dann ohne Trigger. */
  armed?: boolean;
}

export type Decision =
  | { kind: 'accept'; command: Command; text: string }
  | {
      kind: 'reject';
      reason: 'lowConfidence' | 'lowTriggerConfidence' | 'paused' | 'echo';
      command: Command | null;
      text: string;
      /** Nutzer per Ton/Blitz informieren („nicht verstanden“). */
      signal: boolean;
    }
  | { kind: 'ignore'; reason: 'noCommand'; text: string; signal: boolean }
  /** Nur das Triggerwort gehört – auf die Zahl warten (S7 ARMED). */
  | { kind: 'arm'; text: string };

/** Klang es nach einem Befehl (Triggerwort bzw. Zahl im Direkt-Modus)? Dann lohnt ein „nicht verstanden“. */
export function soundedLikeCommand(text: string, ctx: Pick<DecideContext, 'mode' | 'trigger'>): boolean {
  const t = tokenize(text);
  if (t.length === 0) return false;
  if (t[0] === ctx.trigger.toLowerCase()) return true;
  return ctx.mode === 'direct' && t.some((_, i) => parseNumberAt(t, i) !== null);
}

export function decide(t: Transcript, ctx: DecideContext): Decision {
  if (ctx.echoMuted) return { kind: 'reject', reason: 'echo', command: null, text: t.text, signal: false };
  const tokens = tokenize(t.text);
  const trig = ctx.trigger.toLowerCase();
  if (ctx.mode === 'trigger' && tokens.length === 1 && tokens[0] === trig)
    return { kind: 'arm', text: t.text };
  // zweistufig: nach „Wurf“ allein zählt die folgende Zahl auch ohne Triggerwort
  if (ctx.armed && tokens[0] !== trig) {
    const withTrigger = decide(
      { ...t, text: `${trig} ${t.text}`, alternatives: t.alternatives.map((a) => `${trig} ${a}`) },
      {
        ...ctx,
        armed: false,
      },
    );
    if (withTrigger.kind === 'accept' || withTrigger.kind === 'reject') return withTrigger;
  }
  const opts = {
    mode: ctx.mode,
    trigger: ctx.trigger,
    aliases: ctx.aliases,
  };
  let command: Command | null = null;
  let used = t.text;
  for (const candidate of [t.text, ...t.alternatives]) {
    command = parseCommand(candidate, opts);
    if (command) {
      used = candidate;
      break;
    }
  }
  if (!command)
    return { kind: 'ignore', reason: 'noCommand', text: t.text, signal: soundedLikeCommand(t.text, ctx) };
  // Wort-Konfidenzen: Triggerwort getrennt und strenger prüfen, den Rest (die Zahl) für sich
  const words = t.words ?? [];
  const triggerWord = words[0]?.word === trig ? words[0] : undefined;
  if (triggerWord && triggerWord.conf < ctx.triggerMinConfidence)
    return { kind: 'reject', reason: 'lowTriggerConfidence', command, text: used, signal: false };
  const rest = triggerWord ? words.slice(1) : words;
  const conf = rest.length ? rest.reduce((s, w) => s + w.conf, 0) / rest.length : t.confidence;
  if (conf !== null && conf < ctx.minConfidence)
    return { kind: 'reject', reason: 'lowConfidence', command, text: used, signal: true };
  if (ctx.paused) return { kind: 'reject', reason: 'paused', command, text: used, signal: false };
  return { kind: 'accept', command, text: used };
}
