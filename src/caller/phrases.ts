// Alle Ansagen an einer Stelle. Nüchtern = Deutsch, Arena = englischer Ansager-Stil (eigene Formulierungen).
// Jede Ansage besteht aus Bausteinen (Cues): Text für die Systemstimme + optional Schlüssel eines Clips im
// Klang-Paket (src/caller/voicepack.ts). Bausteine mit Spielernamen gibt es nur als Text.
import { dartLabel } from '../engine/checkouts';
import type { Dart } from '../engine/types';
import type { CallerStyle } from '../settings/types';
import { numberToWords } from '../voice/numbers.de';
import { numberToEnglish, ordinalEnglish } from './numbers.en';
import { K } from './voicepack';

export interface Cue {
  text: string;
  /** Clip im Klang-Paket; fehlt er, spricht die Systemstimme den Text. */
  key?: string;
  /** Enthält einen Spielernamen – im Paket-Modus weggelassen (kein Stimmenwechsel mitten im Satz). */
  name?: true;
}

type Cues = Cue[];

export interface Phrasebook {
  lang: 'de-DE' | 'en-GB';
  score: (n: number) => Cues;
  maximum: Cues;
  remaining: (n: number) => Cues;
  bust: (remaining: number) => Cues;
  require: (n: number) => Cues;
  yourTurn: (name: string) => Cues;
  route: (route: Dart[]) => Cues;
  legShot: (name: string, legNumber: number) => Cues;
  highFinish: (n: number) => Cues;
  matchShot: (name: string) => Cues;
  impossible: Cues;
  undone: (name: string, remaining: number) => Cues;
  corrected: (n: number, remaining: number) => Cues;
  askCheckoutDarts: Cues;
  askDartsAtDouble: Cues;
  answered: (n: number) => Cues;
  gameOn: (name: string) => Cues;
  versus: (names: string[]) => Cues;
  newLeg: Cues;
  pause: Cues;
  resume: Cues;
  micOff: Cues;
  target: (label: string, n: number | null, atc: boolean) => Cues;
  trainingDone: (success: boolean, darts: number) => Cues;
}

const deNum = (n: number) => (n >= 0 && n <= 999 ? numberToWords(n) : String(n));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const cue = (text: string, key?: string): Cue => (key ? { text, key } : { text });
const named = (text: string): Cue => ({ text, name: true });
const restKey = (n: number) => (n >= 1 && n <= 501 ? K.rest(n) : undefined);
const requireKey = (n: number) => (n >= 2 && n <= 180 ? K.require(n) : undefined);
const scoreKey = (n: number) => (n >= 0 && n <= 180 ? K.score(n) : undefined);

function deDart(d: Dart): string {
  if (d.segment === 0) return 'daneben';
  if (d.segment === 25) return d.multiplier === 2 ? 'Bull' : 'Single Bull';
  const m = d.multiplier === 3 ? 'Triple' : d.multiplier === 2 ? 'Doppel' : '';
  return `${m} ${numberToWords(d.segment)}`.trim();
}

function enDart(d: Dart): string {
  if (d.segment === 0) return 'miss';
  if (d.segment === 25) return d.multiplier === 2 ? 'bullseye' : 'twenty-five';
  const m = d.multiplier === 3 ? 'treble' : d.multiplier === 2 ? 'double' : '';
  return `${m} ${numberToEnglish(d.segment)}`.trim();
}

function atcTarget(n: number | null, label: string, de: boolean): Cue {
  if (n !== null && n >= 1 && n <= 20)
    return cue(de ? `Ziel: ${deNum(n)}.` : `Target, ${numberToEnglish(n)}.`, K.target(n));
  if (label === 'Bull') return cue(de ? 'Ziel: Bull.' : 'Target, the bull.', K.targetBull);
  return cue(de ? `Ziel: ${label}.` : `Target: ${label}.`);
}

export const PLAIN: Phrasebook = {
  lang: 'de-DE',
  score: (n) => [cue(`${capital(deNum(n))}.`, scoreKey(n))],
  maximum: [cue('Hundertachtzig!', K.score(180))],
  remaining: (n) => [cue(`Rest ${deNum(n)}.`, restKey(n))],
  bust: (r) => [cue('Überworfen.', K.bust), cue(`Rest ${deNum(r)}.`, restKey(r))],
  require: (n) => [cue(`Du brauchst ${deNum(n)}.`, requireKey(n))],
  yourTurn: (name) => [named(`${name}, du bist dran.`)],
  route: (r) => [cue(`Weg: ${r.map(deDart).join(', ')}.`)],
  legShot: (name) => [cue('Check!', K.legWon), named(`Leg für ${name}.`)],
  highFinish: (n) => [cue('Highfinish!', K.highFinish), cue(`${capital(deNum(n))}!`, scoreKey(n))],
  matchShot: (name) => [cue('Match gewonnen:', K.matchWon), named(`${name}!`)],
  impossible: [cue('Nicht möglich.', K.impossible)],
  undone: (name, r) => [cue('Zurück.', K.undo), named(`${name},`), cue(`Rest ${deNum(r)}.`, restKey(r))],
  corrected: (n, r) => [
    cue('Korrigiert:', K.corrected),
    cue(`${deNum(n)}.`, scoreKey(n)),
    cue(`Rest ${deNum(r)}.`, restKey(r)),
  ],
  askCheckoutDarts: [cue('Mit wie vielen Darts?', K.askDarts)],
  askDartsAtDouble: [cue('Darts auf Doppel?', K.askDouble)],
  answered: (n) => [cue(`${capital(deNum(n))}.`, scoreKey(n))],
  gameOn: (name) => [named(`${name} beginnt.`), cue('Spiel an!', K.gameOn)],
  versus: (names) => [named(`${names.slice(0, -1).join(', ')} gegen ${names.at(-1)}.`)],
  newLeg: [cue('Neues Leg.', K.newLeg)],
  pause: [cue('Pause.', K.pause)],
  resume: [cue('Weiter.', K.resume)],
  micOff: [cue('Mikro aus.', K.micOff)],
  target: (label, n, atc) =>
    atc
      ? [atcTarget(n, label, true)]
      : [cue(`Ziel: ${n === null ? label : deNum(n)}.`, n === null ? undefined : requireKey(n))],
  trainingDone: (ok, darts) =>
    ok
      ? [cue('Geschafft', K.trainingOk), cue(`mit ${deNum(darts)} Darts!`)]
      : [cue('Nicht geschafft.', K.trainingFail)],
};

export const ARENA: Phrasebook = {
  lang: 'en-GB',
  score: (n) => [cue(n === 0 ? 'No score!' : `${capital(numberToEnglish(n))}!`, scoreKey(n))],
  maximum: [cue('One hundred and eighty!', K.score(180))],
  remaining: (n) => [cue(`${capital(numberToEnglish(n))} remaining.`)],
  bust: () => [cue('No score!', K.bust)],
  require: (n) => [cue(`You require ${numberToEnglish(n)}.`, requireKey(n))],
  yourTurn: (name) => [named(`${name},`)],
  route: (r) => [cue(`${capital(r.map(enDart).join(', '))}.`)],
  legShot: (_name, legNumber) => [
    cue(
      `Game shot, and the ${ordinalEnglish(legNumber)} leg!`,
      legNumber <= 13 ? K.leg(legNumber) : K.legWon,
    ),
  ],
  highFinish: (n) => [
    cue('What a finish!', K.highFinish),
    cue(`${capital(numberToEnglish(n))}!`, scoreKey(n)),
  ],
  matchShot: (name) => [cue('Game shot, and the match!', K.matchWon), named(`${name}!`)],
  impossible: [cue('Not possible.', K.impossible)],
  undone: (name, r) => [
    cue('Score removed.', K.undo),
    named(`${name},`),
    cue(`${numberToEnglish(r)} remaining.`),
  ],
  corrected: (n, r) => [
    cue('Corrected,', K.corrected),
    cue(`${numberToEnglish(n)}.`, scoreKey(n)),
    cue(`${capital(numberToEnglish(r))} remaining.`),
  ],
  askCheckoutDarts: [cue('How many darts?', K.askDarts)],
  askDartsAtDouble: [cue('Darts at the double?', K.askDouble)],
  answered: (n) => [cue(`${capital(numberToEnglish(n))}.`, n >= 1 ? scoreKey(n) : undefined)],
  gameOn: (name) => [named(`${name} to throw first.`), cue('Game on!', K.gameOn)],
  versus: (names) => [named(`${names.slice(0, -1).join(', ')} versus ${names.at(-1)}.`)],
  newLeg: [cue('New leg.', K.newLeg)],
  pause: [cue('Pause.', K.pause)],
  resume: [cue('Play on.', K.resume)],
  micOff: [cue('Microphone off.', K.micOff)],
  target: (label, n, atc) =>
    atc
      ? [atcTarget(n, label, false)]
      : [
          cue(
            n === null ? `Target: ${label}.` : `You require ${numberToEnglish(n)}.`,
            n === null ? undefined : requireKey(n),
          ),
        ],
  trainingDone: (ok, darts) =>
    ok
      ? [cue('Game shot!', K.trainingOk), cue(`${capital(numberToEnglish(darts))} darts.`)]
      : [cue('Missed it.', K.trainingFail)],
};

export function phrasebook(style: CallerStyle): Phrasebook {
  return style === 'arena' ? ARENA : PLAIN;
}

/** Alle Bausteine als ein Satz (Systemstimme, Tests). */
export function cuesToText(cues: readonly Cue[]): string {
  return cues
    .map((c) => c.text)
    .filter(Boolean)
    .join(' ');
}

/** Kurzform eines Wegs für Logs/Tests. */
export function routeLabel(route: Dart[]): string {
  return route.map(dartLabel).join(' ');
}
