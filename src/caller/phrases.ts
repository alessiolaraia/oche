// Alle Ansagen an einer Stelle. Nüchtern = Deutsch, Arena = englischer Ansager-Stil (eigene Formulierungen).
import { dartLabel } from '../engine/checkouts';
import type { Dart } from '../engine/types';
import type { CallerStyle } from '../settings/types';
import { numberToWords } from '../voice/numbers.de';
import { numberToEnglish, ordinalEnglish } from './numbers.en';

export interface Phrasebook {
  lang: 'de-DE' | 'en-GB';
  score: (n: number) => string;
  maximum: string;
  remaining: (n: number) => string;
  bust: (remaining: number) => string;
  require: (n: number) => string;
  yourTurn: (name: string) => string;
  route: (route: Dart[]) => string;
  legShot: (name: string, legNumber: number) => string;
  highFinish: (n: number) => string;
  matchShot: (name: string) => string;
  impossible: string;
  undone: (name: string, remaining: number) => string;
  corrected: (n: number, remaining: number) => string;
  askCheckoutDarts: string;
  askDartsAtDouble: string;
  answered: (n: number) => string;
  gameOn: (name: string) => string;
  newLeg: string;
  pause: string;
  resume: string;
  micOff: string;
  target: (label: string, n: number | null) => string;
  trainingDone: (success: boolean, darts: number) => string;
}

const deNum = (n: number) => (n >= 0 && n <= 999 ? numberToWords(n) : String(n));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export const PLAIN: Phrasebook = {
  lang: 'de-DE',
  score: (n) => `${capital(deNum(n))}.`,
  maximum: 'Hundertachtzig!',
  remaining: (n) => `Rest ${deNum(n)}.`,
  bust: (r) => `Überworfen. Rest ${deNum(r)}.`,
  require: (n) => `Du brauchst ${deNum(n)}.`,
  yourTurn: (name) => `${name}, du bist dran.`,
  route: (r) => `Weg: ${r.map(deDart).join(', ')}.`,
  legShot: (name) => `Check! Leg für ${name}.`,
  highFinish: (n) => `Highfinish! ${capital(deNum(n))}!`,
  matchShot: (name) => `Match gewonnen: ${name}!`,
  impossible: 'Nicht möglich.',
  undone: (name, r) => `Zurück. ${name}, Rest ${deNum(r)}.`,
  corrected: (n, r) => `Korrigiert: ${deNum(n)}. Rest ${deNum(r)}.`,
  askCheckoutDarts: 'Mit wie vielen Darts?',
  askDartsAtDouble: 'Darts auf Doppel?',
  answered: (n) => `${capital(deNum(n))}.`,
  gameOn: (name) => `${name} beginnt. Spiel an!`,
  newLeg: 'Neues Leg.',
  pause: 'Pause.',
  resume: 'Weiter.',
  micOff: 'Mikro aus.',
  target: (label, n) => `Ziel: ${n === null ? label : deNum(n)}.`,
  trainingDone: (ok, darts) => (ok ? `Geschafft mit ${deNum(darts)} Darts!` : 'Nicht geschafft.'),
};

export const ARENA: Phrasebook = {
  lang: 'en-GB',
  score: (n) => (n === 0 ? 'No score!' : `${capital(numberToEnglish(n))}!`),
  maximum: 'One hundred and eighty!',
  remaining: (n) => `${capital(numberToEnglish(n))} remaining.`,
  bust: () => 'No score!',
  require: (n) => `You require ${numberToEnglish(n)}.`,
  yourTurn: (name) => `${name},`,
  route: (r) => `${capital(r.map(enDart).join(', '))}.`,
  legShot: (_name, legNumber) => `Game shot, and the ${ordinalEnglish(legNumber)} leg!`,
  highFinish: (n) => `What a finish! ${capital(numberToEnglish(n))}!`,
  matchShot: (name) => `Game shot, and the match! ${name}!`,
  impossible: 'Not possible.',
  undone: (name, r) => `Score removed. ${name}, ${numberToEnglish(r)} remaining.`,
  corrected: (n, r) => `Corrected, ${numberToEnglish(n)}. ${capital(numberToEnglish(r))} remaining.`,
  askCheckoutDarts: 'How many darts?',
  askDartsAtDouble: 'Darts at the double?',
  answered: (n) => `${capital(numberToEnglish(n))}.`,
  gameOn: (name) => `${name} to throw first. Game on!`,
  newLeg: 'New leg.',
  pause: 'Pause.',
  resume: 'Play on.',
  micOff: 'Microphone off.',
  target: (label, n) => (n === null ? `Target: ${label}.` : `You require ${numberToEnglish(n)}.`),
  trainingDone: (ok, darts) => (ok ? `Game shot! ${capital(numberToEnglish(darts))} darts.` : 'Missed it.'),
};

export function phrasebook(style: CallerStyle): Phrasebook {
  return style === 'arena' ? ARENA : PLAIN;
}

/** Kurzform eines Wegs für Logs/Tests. */
export function routeLabel(route: Dart[]): string {
  return route.map(dartLabel).join(' ');
}
