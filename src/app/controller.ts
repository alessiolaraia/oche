// Einziger Einstiegspunkt für Eingaben – Touch und Sprache laufen beide hier durch.
import { evaluateDarts } from '../engine/darts';
import type { Dart, MatchConfig, VisitEvent } from '../engine/types';
import { annotateLast, checkCorrection, checkVisit, correctLast, reduce, undoLast } from '../engine/x01';
import { newId, useMatch } from '../store/match';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { emitFeedback, type Question } from './feedback';

export type InputSource = 'voice' | 'touch';

/** Trainingsmodi ohne X01 (Around the Clock) übernehmen Eingaben selbst. */
interface TrainingHooks {
  visit: (score: number) => boolean;
  undo: () => boolean;
}
let trainingHooks: TrainingHooks | null = null;

export function setTrainingHooks(h: TrainingHooks | null): void {
  trainingHooks = h;
}

function afterInput(source: InputSource) {
  if (source === 'voice') useSession.getState().markVoiceInput();
}

export function startMatch(config: MatchConfig): void {
  const state = useMatch.getState().start(config);
  const session = useSession.getState();
  session.setQuestion(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Mit Intro kommt die Ansage („A gegen B …“) erst, wenn die Namen eingeblendet werden
  if (useSettings.getState().display.intro && !reduced) session.setIntro(true);
  else emitFeedback({ type: 'matchStarted', state });
}

/** Vom Intro aufgerufen, sobald die Namen erscheinen (oder beim Überspringen). */
export function announceMatchStart(): void {
  const { state } = useMatch.getState();
  if (state) emitFeedback({ type: 'matchStarted', state });
}

export function submitVisit(
  score: number,
  opts: { bust?: boolean; darts?: Dart[]; dartsUsed?: number; dartsAtDouble?: number; source: InputSource },
): boolean {
  if (trainingHooks) {
    afterInput(opts.source);
    return trainingHooks.visit(opts.bust ? 0 : score);
  }
  const { state, events } = useMatch.getState();
  if (!state) {
    emitFeedback({ type: 'rejected', reason: 'gameOver' });
    return false;
  }
  const outcome = checkVisit(state, score, { bust: opts.bust, dartsUsed: opts.dartsUsed });
  if (!outcome.ok) {
    emitFeedback({ type: 'rejected', reason: outcome.reason });
    return false;
  }
  const ev: VisitEvent = {
    type: 'visit',
    id: newId(),
    score: opts.bust ? 0 : score,
    ts: Date.now(),
    ...(opts.bust ? { bust: true } : {}),
    ...(opts.darts ? { darts: opts.darts } : {}),
    ...(opts.dartsUsed ? { dartsUsed: opts.dartsUsed } : {}),
    ...(opts.dartsAtDouble !== undefined ? { dartsAtDouble: opts.dartsAtDouble } : {}),
  };
  const next = useMatch.getState().setEvents([...events, ev]);
  const result = next.lastVisit!;
  afterInput(opts.source);

  // Nachfrage vor dem Visit-Ereignis setzen, damit die Ansage weiß, dass erst gefragt wird
  const g = useSettings.getState().game;
  const isMatch = useMatch.getState().kind === 'x01';
  const question: Question | null = !isMatch
    ? null
    : result.checkout && opts.dartsUsed === undefined && g.askCheckoutDarts
      ? 'checkoutDarts'
      : result.checkout && opts.dartsAtDouble === undefined && g.askDartsAtDouble
        ? 'dartsAtDouble'
        : null;
  useSession.getState().setQuestion(question);
  emitFeedback({ type: 'visit', result, state: next });
  if (question) emitFeedback({ type: 'question', question });
  return true;
}

export function submitDarts(darts: Dart[], source: InputSource): boolean {
  const { state } = useMatch.getState();
  if (!state) return false;
  const p = state.players[state.current]!;
  const r = evaluateDarts(darts, p.remaining, state.config.outMode);
  return submitVisit(r.score, {
    bust: r.bust,
    darts,
    dartsUsed: r.dartsUsed,
    dartsAtDouble: state.config.outMode === 'straight' ? undefined : r.dartsAtDouble,
    source,
  });
}

export function undo(source: InputSource): boolean {
  if (trainingHooks) {
    const ok = trainingHooks.undo();
    if (!ok) emitFeedback({ type: 'rejected', reason: 'nothingToUndo' });
    return ok;
  }
  const { events } = useMatch.getState();
  const next = undoLast(events);
  if (next.length === events.length) {
    emitFeedback({ type: 'rejected', reason: 'nothingToUndo' });
    return false;
  }
  const state = useMatch.getState().setEvents(next);
  afterInput(source);
  useSession.getState().setQuestion(null);
  emitFeedback({ type: 'undo', state });
  return true;
}

/** „Nein“ / „Falsch“: nur innerhalb des Bestätigungsfensters nach einer Spracheingabe. */
export function rejectRecent(): boolean {
  const { lastVoiceInputAt } = useSession.getState();
  const windowMs = useSettings.getState().voice.confirmWindowMs;
  if (Date.now() - lastVoiceInputAt > windowMs) {
    emitFeedback({ type: 'rejected', reason: 'noQuestion' });
    return false;
  }
  useSession.setState({ lastVoiceInputAt: 0 });
  return undo('touch');
}

export function correctLastVisit(score: number, source: InputSource): boolean {
  const { config, events } = useMatch.getState();
  if (!config) return false;
  const outcome = checkCorrection(config, events, score);
  if (!outcome.ok) {
    emitFeedback({ type: 'rejected', reason: outcome.reason });
    return false;
  }
  const state = useMatch.getState().setEvents(correctLast(events, { score }));
  afterInput(source);
  // die korrigierte Aufnahme ist die letzte Aufnahme im Verlauf (ggf. in einem abgeschlossenen Leg)
  const all = [...state.legs.flatMap((l) => l.visits), ...state.currentLeg];
  const result = all.at(-1);
  if (result) emitFeedback({ type: 'corrected', result, state });
  return true;
}

export function answerQuestion(value: number): boolean {
  const { question } = useSession.getState();
  const { config, events, state } = useMatch.getState();
  if (!question || !config || !state) {
    emitFeedback({ type: 'rejected', reason: 'noQuestion' });
    return false;
  }
  if (question === 'checkoutDarts') {
    const next = annotateLast(events, { dartsUsed: value });
    // mit zu wenigen Darts wäre der Checkout ungültig → ablehnen
    if (value < 1 || value > 3 || reduce(config, next).legs.length !== state.legs.length) {
      emitFeedback({ type: 'rejected', reason: 'notFinishable' });
      return false;
    }
    useMatch.getState().setEvents(next);
    const followUp = useSettings.getState().game.askDartsAtDouble;
    useSession.getState().setQuestion(followUp ? 'dartsAtDouble' : null);
    emitFeedback({ type: 'answered', question, value });
    if (followUp) emitFeedback({ type: 'question', question: 'dartsAtDouble' });
    return true;
  }
  if (value < 0 || value > 3) {
    emitFeedback({ type: 'rejected', reason: 'impossible' });
    return false;
  }
  useMatch.getState().setEvents(annotateLast(events, { dartsAtDouble: value }));
  useSession.getState().setQuestion(null);
  emitFeedback({ type: 'answered', question, value });
  return true;
}

export function dismissQuestion(): void {
  useSession.getState().setQuestion(null);
}

export function requestRemaining(): void {
  const { state } = useMatch.getState();
  if (state) emitFeedback({ type: 'remaining', state });
}

export function restartLeg(): void {
  const { events, state } = useMatch.getState();
  if (!state) return;
  const next = useMatch
    .getState()
    .setEvents([...events, { type: 'restartLeg', id: newId(), ts: Date.now() }]);
  emitFeedback({ type: 'legRestarted', state: next });
}

export function setStarter(player: number): void {
  const { events } = useMatch.getState();
  useMatch.getState().setEvents([...events, { type: 'starter', id: newId(), player, ts: Date.now() }]);
}
