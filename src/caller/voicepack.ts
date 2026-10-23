// Klang-Paket: EINZIGE Quelle für Clip-Schlüssel, Texte und Intensität.
// scripts/voicepack/generate.py erzeugt daraus die Audiodateien, der Caller spielt sie per Schlüssel ab.
import { isFinishable } from '../engine/checkouts';
import { isPossibleVisit } from '../engine/rules';
import { numberToWords } from '../voice/numbers.de';
import { numberToEnglish, ordinalEnglish } from './numbers.en';

export type PackLang = 'de' | 'en';
/** Intensität: ruhig → Maximum. Steuert Emotionsstärke und Lautheit bei der Erzeugung. */
export type Level = 'calm' | 'normal' | 'ton' | 'big' | 'max';

export interface Clip {
  key: string;
  text: string;
  level: Level;
}

export const PACK_ID: Record<PackLang, string> = { de: 'oche-de', en: 'oche-en' };

/** Intensität einer Aufnahme: je höher die Punktzahl, desto mehr Bühne. */
export function scoreLevel(n: number): Level {
  if (n === 180) return 'max';
  if (n >= 140) return 'big';
  if (n >= 100) return 'ton';
  if (n >= 60) return 'normal';
  return 'calm';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MAX_REST = 501;
const TRAINING_TARGETS = 20;

/** Schlüssel für Ansagen, die der Caller verwendet. */
export const K = {
  score: (n: number) => `score_${n}`,
  rest: (n: number) => `rest_${n}`,
  require: (n: number) => `require_${n}`,
  leg: (n: number) => `leg_${n}`,
  target: (n: number) => `target_${n}`,
  bust: 'bust',
  gameOn: 'game_on',
  legWon: 'leg',
  setWon: 'set',
  matchWon: 'match',
  highFinish: 'high_finish',
  askDarts: 'ask_darts',
  askDouble: 'ask_double',
  impossible: 'impossible',
  undo: 'undo',
  corrected: 'corrected',
  newLeg: 'new_leg',
  pause: 'pause',
  resume: 'resume',
  micOff: 'mic_off',
  yourTurn: 'your_turn',
  targetBull: 'target_bull',
  trainingOk: 'training_ok',
  trainingFail: 'training_fail',
} as const;

export function packClips(lang: PackLang): Clip[] {
  const clips: Clip[] = [];
  const add = (key: string, text: string, level: Level) => clips.push({ key, text, level });

  for (let n = 0; n <= 180; n++) {
    if (!isPossibleVisit(n)) continue;
    const level = scoreLevel(n);
    const loud = level === 'calm' || level === 'normal' ? '.' : '!';
    if (lang === 'de') add(K.score(n), `${cap(numberToWords(n))}${loud}`, level);
    else add(K.score(n), n === 0 ? 'No score!' : `${cap(numberToEnglish(n))}${loud}`, level);
  }
  for (let n = 2; n <= 180; n++) {
    if (!isFinishable(n, 'master', 3)) continue;
    add(
      K.require(n),
      lang === 'de' ? `Du brauchst ${numberToWords(n)}.` : `You require ${numberToEnglish(n)}.`,
      'calm',
    );
  }
  for (let n = 1; n <= TRAINING_TARGETS; n++) {
    add(K.target(n), lang === 'de' ? `Ziel ${numberToWords(n)}.` : `Target, ${numberToEnglish(n)}.`, 'calm');
  }

  if (lang === 'de') {
    for (let n = 1; n <= MAX_REST; n++) add(K.rest(n), `Rest ${numberToWords(n)}.`, 'calm');
    add(K.bust, 'Überworfen!', 'ton');
    add(K.gameOn, 'Spiel an!', 'ton');
    add(K.legWon, 'Check! Leg gewonnen!', 'big');
    add(K.setWon, 'Set gewonnen!', 'big');
    add(K.matchWon, 'Match gewonnen!', 'max');
    add(K.highFinish, 'Highfinish!', 'big');
    add(K.askDarts, 'Mit wie vielen Darts?', 'calm');
    add(K.askDouble, 'Darts auf Doppel?', 'calm');
    add(K.impossible, 'Nicht möglich.', 'calm');
    add(K.undo, 'Zurück.', 'calm');
    add(K.corrected, 'Korrigiert.', 'calm');
    add(K.newLeg, 'Neues Leg.', 'normal');
    add(K.pause, 'Pause.', 'calm');
    add(K.resume, 'Weiter.', 'calm');
    add(K.micOff, 'Mikro aus.', 'calm');
    add(K.yourTurn, 'Du bist dran.', 'calm');
    add(K.targetBull, 'Ziel Bull.', 'calm');
    add(K.trainingOk, 'Geschafft!', 'big');
    add(K.trainingFail, 'Nicht geschafft.', 'calm');
  } else {
    for (let n = 1; n <= 13; n++) add(K.leg(n), `Game shot, and the ${ordinalEnglish(n)} leg!`, 'big');
    add(K.bust, 'No score!', 'ton');
    add(K.gameOn, 'Game on!', 'ton');
    add(K.legWon, 'Game shot, and the leg!', 'big');
    add(K.setWon, 'Game shot, and the set!', 'big');
    add(K.matchWon, 'Game shot, and the match!', 'max');
    add(K.highFinish, 'What a finish!', 'big');
    add(K.askDarts, 'How many darts?', 'calm');
    add(K.askDouble, 'Darts at the double?', 'calm');
    add(K.impossible, 'Not possible.', 'calm');
    add(K.undo, 'Score removed.', 'calm');
    add(K.corrected, 'Corrected.', 'calm');
    add(K.newLeg, 'New leg.', 'normal');
    add(K.pause, 'Pause.', 'calm');
    add(K.resume, 'Play on.', 'calm');
    add(K.micOff, 'Microphone off.', 'calm');
    add(K.yourTurn, 'Your throw.', 'calm');
    add(K.targetBull, 'Target, the bull.', 'calm');
    add(K.trainingOk, 'Game shot!', 'big');
    add(K.trainingFail, 'Missed it.', 'calm');
  }
  return clips;
}
