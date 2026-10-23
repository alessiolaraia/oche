// Trainingsmodi: Checkout-Training und 121-Challenge laufen als Einzel-X01-Runden,
// Around the Clock zählt Treffer pro Aufnahme („Wurf zwei“ = zwei Treffer).
import { db } from '../db/db';
import { seededRng } from '../engine/bot';
import {
  ATC_DONE,
  atcApply,
  atcLabel,
  atcStart,
  next121,
  randomCheckoutTarget,
  type TrainingMode,
} from '../engine/training';
import type { MatchConfig } from '../engine/types';
import { newId, useMatch } from '../store/match';
import { useSettings } from '../store/settings';
import { useTraining } from '../store/training';
import { setTrainingHooks } from './controller';
import { emitFeedback, onFeedback } from './feedback';

const rng = seededRng(Date.now() % 2 ** 31);
const NEXT_ROUND_MS = 1800;

function playerName(): string {
  return useSettings.getState().players.recent[0] ?? 'Spieler 1';
}

function roundConfig(target: number): MatchConfig {
  return {
    startScore: target,
    inMode: 'straight',
    outMode: 'double',
    legs: { mode: 'firstTo', count: 1 },
    sets: null,
    players: [{ id: 'training', name: playerName() }],
    startOrder: 'alternate',
  };
}

function startRound(mode: 'checkout' | '121', target: number) {
  useTraining.getState().set({ target });
  useMatch.getState().start(roundConfig(target), mode);
  emitFeedback({ type: 'trainingTarget', mode, target, label: String(target) });
}

export function startTraining(mode: TrainingMode): void {
  const t = useTraining.getState();
  t.set({ mode, results: [], atc: atcStart(), atcHistory: [], maxVisits: mode === 'checkout' ? 1 : 3 });
  if (mode === 'atc') {
    useMatch.getState().close();
    setTrainingHooks({ visit: atcVisit, undo: atcUndo });
    emitFeedback({ type: 'trainingTarget', mode, target: 1, label: atcLabel(1) });
    return;
  }
  setTrainingHooks(null);
  startRound(mode, mode === '121' ? 121 : randomCheckoutTarget(rng));
}

export function stopTraining(): void {
  setTrainingHooks(null);
  const { mode } = useTraining.getState();
  if (mode && mode !== 'atc') useMatch.getState().close();
  useTraining.getState().set({ mode: null });
}

function atcVisit(hits: number): boolean {
  if (!Number.isInteger(hits) || hits < 0 || hits > 3) {
    emitFeedback({ type: 'rejected', reason: 'impossible' });
    return false;
  }
  const { atc, atcHistory } = useTraining.getState();
  const next = atcApply(atc, hits);
  useTraining.getState().set({ atc: next, atcHistory: [...atcHistory, atc] });
  if (next.target >= ATC_DONE) {
    void save('atc', 0, true, next.darts);
    emitFeedback({ type: 'trainingResult', success: true, darts: next.darts });
  } else {
    emitFeedback({ type: 'trainingTarget', mode: 'atc', target: next.target, label: atcLabel(next.target) });
  }
  return true;
}

function atcUndo(): boolean {
  const { atcHistory } = useTraining.getState();
  const prev = atcHistory.at(-1);
  if (!prev) return false;
  useTraining.getState().set({ atc: prev, atcHistory: atcHistory.slice(0, -1) });
  emitFeedback({ type: 'trainingTarget', mode: 'atc', target: prev.target, label: atcLabel(prev.target) });
  return true;
}

async function save(mode: TrainingMode, target: number, success: boolean, darts: number) {
  await db.trainings.put({ id: newId(), mode, at: Date.now(), target, success, darts });
}

/** Wertet Checkout-/121-Runden nach jeder Aufnahme aus. */
export function installTraining(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const off = onFeedback((e) => {
    if (e.type !== 'visit') return;
    const t = useTraining.getState();
    const kind = useMatch.getState().kind;
    if ((t.mode !== 'checkout' && t.mode !== '121') || kind !== t.mode) return;
    const won = e.state.winner !== null;
    const visits = won ? (e.state.legs.at(-1)?.visits ?? []) : e.state.currentLeg;
    if (!won && visits.length < t.maxVisits) return;
    const darts = visits.reduce((s, v) => s + v.darts, 0);
    const mode = t.mode;
    t.set({ results: [...t.results, { target: t.target, success: won, darts }] });
    void save(mode, t.target, won, darts);
    emitFeedback({ type: 'trainingResult', success: won, darts });
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (useTraining.getState().mode !== mode) return;
      startRound(mode, mode === '121' ? next121(t.target, won) : randomCheckoutTarget(rng));
    }, NEXT_ROUND_MS);
  });
  return () => {
    clearTimeout(timer);
    off();
  };
}
