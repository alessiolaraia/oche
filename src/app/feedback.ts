import type { MatchState, VisitResult } from '../engine/types';

export type RejectReason =
  'impossible' | 'notFinishable' | 'gameOver' | 'notUnderstood' | 'nothingToUndo' | 'noQuestion';

export type Question = 'checkoutDarts' | 'dartsAtDouble';

export type FeedbackEvent =
  | { type: 'visit'; result: VisitResult; state: MatchState }
  | { type: 'corrected'; result: VisitResult; state: MatchState }
  | { type: 'undo'; state: MatchState }
  | { type: 'rejected'; reason: RejectReason; heard?: string }
  | { type: 'remaining'; state: MatchState }
  | { type: 'question'; question: Question }
  | { type: 'answered'; question: Question; value: number }
  | { type: 'matchStarted'; state: MatchState }
  | { type: 'legRestarted'; state: MatchState }
  | { type: 'control'; action: 'pause' | 'resume' | 'micOff' }
  | { type: 'trainingTarget'; mode: 'atc' | 'checkout' | '121'; target: number; label: string }
  | { type: 'trainingResult'; success: boolean; darts: number };

type Listener = (e: FeedbackEvent) => void;
const listeners = new Set<Listener>();

export function onFeedback(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function emitFeedback(e: FeedbackEvent): void {
  for (const l of listeners) l(e);
}
