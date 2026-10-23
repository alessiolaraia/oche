import { isFinishable } from './checkouts';
import { evaluateVisit, startsIn, winsNeeded, type VisitOutcome } from './rules';
import type { MatchConfig, MatchEvent, MatchState, PlayerState, VisitEvent, VisitResult } from './types';

export function initialState(config: MatchConfig): MatchState {
  if (config.players.length < 1 || config.players.length > 8) throw new Error('1–8 Spieler erlaubt');
  return {
    config,
    players: config.players.map(() => freshPlayer(config)),
    current: 0,
    matchStarter: 0,
    legStarter: 0,
    legNumber: 1,
    setNumber: 1,
    legInSet: 1,
    currentLeg: [],
    legs: [],
    winner: null,
    lastVisit: null,
  };
}

function freshPlayer(config: MatchConfig): PlayerState {
  return { remaining: config.startScore, isIn: startsIn(config.inMode), legsWon: 0, setsWon: 0 };
}

/** Prüft eine Aufnahme für den Spieler am Zug, ohne den Stand zu ändern. */
export function checkVisit(
  state: MatchState,
  score: number,
  opts: { bust?: boolean; dartsUsed?: number } = {},
): VisitOutcome {
  if (state.winner !== null) return { ok: false, reason: 'gameOver' };
  const p = state.players[state.current]!;
  return evaluateVisit(p.remaining, p.isIn, score, state.config.outMode, opts);
}

function applyVisit(state: MatchState, ev: VisitEvent): MatchState {
  const outcome = checkVisit(state, ev.score, { bust: ev.bust, dartsUsed: ev.dartsUsed });
  if (!outcome.ok) return state; // ungültige Events werden ignoriert (Store prüft vorher)

  const { config } = state;
  const idx = state.current;
  const before = state.players[idx]!;
  const isCheckout = outcome.kind === 'checkout';
  const isBust = outcome.kind === 'bust';
  const scored = isBust || outcome.kind === 'notIn' ? 0 : ev.score;
  const remainingAfter = before.remaining - scored;

  const result: VisitResult = {
    eventId: ev.id,
    player: idx,
    declared: ev.score,
    scored,
    bust: isBust,
    checkout: isCheckout,
    remainingBefore: before.remaining,
    remainingAfter,
    darts: isCheckout ? clampDarts(ev.dartsUsed) : 3,
    dartsAtDouble: ev.dartsAtDouble,
    hadCheckoutChance: before.isIn && isFinishable(before.remaining, config.outMode, 3),
    legNumber: state.legNumber,
    setNumber: state.setNumber,
  };

  const players = state.players.map((p, i) =>
    i === idx ? { ...p, remaining: remainingAfter, isIn: p.isIn || scored > 0 } : p,
  );
  const currentLeg = [...state.currentLeg, result];

  if (!isCheckout) {
    return {
      ...state,
      players,
      currentLeg,
      current: (idx + 1) % players.length,
      lastVisit: result,
    };
  }
  return finishLeg({ ...state, players, currentLeg, lastVisit: result }, idx);
}

function clampDarts(n: number | undefined): number {
  return n === undefined ? 3 : Math.min(3, Math.max(1, Math.round(n)));
}

function finishLeg(state: MatchState, legWinner: number): MatchState {
  const { config } = state;
  const legs = [
    ...state.legs,
    {
      legNumber: state.legNumber,
      setNumber: state.setNumber,
      starter: state.legStarter,
      winner: legWinner,
      visits: state.currentLeg,
    },
  ];
  let players = state.players.map((p, i) => (i === legWinner ? { ...p, legsWon: p.legsWon + 1 } : p));
  const legTarget = winsNeeded(config.legs);
  let setNumber = state.setNumber;
  let legInSet = state.legInSet + 1;
  let winner: number | null = null;

  if (players[legWinner]!.legsWon >= legTarget) {
    if (config.sets) {
      players = players.map((p, i) => ({ ...p, legsWon: 0, setsWon: p.setsWon + (i === legWinner ? 1 : 0) }));
      if (players[legWinner]!.setsWon >= winsNeeded(config.sets)) winner = legWinner;
      setNumber += 1;
      legInSet = 1;
    } else {
      winner = legWinner;
    }
  }

  const legNumber = state.legNumber + 1;
  const legStarter = (state.matchStarter + legNumber - 1) % players.length;
  if (winner === null)
    players = players.map((p) => ({ ...p, remaining: config.startScore, isIn: startsIn(config.inMode) }));

  return {
    ...state,
    players,
    legs,
    winner,
    legNumber: winner === null ? legNumber : state.legNumber,
    setNumber: winner === null ? setNumber : state.setNumber,
    legInSet: winner === null ? legInSet : state.legInSet,
    legStarter: winner === null ? legStarter : state.legStarter,
    current: winner === null ? legStarter : legWinner,
    currentLeg: [],
  };
}

export function applyEvent(state: MatchState, ev: MatchEvent): MatchState {
  switch (ev.type) {
    case 'visit':
      return applyVisit(state, ev);
    case 'starter': {
      // Bull-Out nur vor der ersten Aufnahme
      if (state.legs.length > 0 || state.currentLeg.length > 0) return state;
      const p = ev.player % state.players.length;
      return { ...state, matchStarter: p, legStarter: p, current: p };
    }
    case 'restartLeg':
      if (state.winner !== null) return state;
      return {
        ...state,
        players: state.players.map((p) => ({
          ...p,
          remaining: state.config.startScore,
          isIn: startsIn(state.config.inMode),
        })),
        currentLeg: [],
        current: state.legStarter,
        lastVisit: null,
      };
  }
}

export function reduce(config: MatchConfig, events: readonly MatchEvent[]): MatchState {
  return events.reduce(applyEvent, initialState(config));
}

/** Entfernt die letzte Aufnahme (und ein ggf. danach folgendes „Neues Leg“). */
export function undoLast(events: readonly MatchEvent[]): MatchEvent[] {
  const i = findLastIndex(events, (e) => e.type === 'visit' || e.type === 'restartLeg');
  return i < 0 ? [...events] : [...events.slice(0, i), ...events.slice(i + 1)];
}

/** Ersetzt die Punktzahl der letzten Aufnahme. */
export function correctLast(
  events: readonly MatchEvent[],
  patch: Pick<VisitEvent, 'score'> & Partial<Pick<VisitEvent, 'bust' | 'dartsUsed' | 'darts'>>,
): MatchEvent[] {
  const i = findLastIndex(events, (e) => e.type === 'visit');
  if (i < 0) return [...events];
  const old = events[i] as VisitEvent;
  const replaced: VisitEvent = {
    type: 'visit',
    id: old.id,
    ts: old.ts,
    score: patch.score,
    ...(patch.bust ? { bust: true } : {}),
    ...(patch.dartsUsed ? { dartsUsed: patch.dartsUsed } : {}),
    ...(patch.darts ? { darts: patch.darts } : {}),
  };
  return [...events.slice(0, i), replaced, ...events.slice(i + 1)];
}

/** Ergänzt Checkout-Details (Darts, Darts aufs Doppel) an der letzten Aufnahme. */
export function annotateLast(
  events: readonly MatchEvent[],
  patch: Partial<Pick<VisitEvent, 'dartsUsed' | 'dartsAtDouble'>>,
): MatchEvent[] {
  const i = findLastIndex(events, (e) => e.type === 'visit');
  if (i < 0) return [...events];
  return events.map((e, k) => (k === i ? { ...(e as VisitEvent), ...patch } : e));
}

/**
 * Prüft, ob die letzte Aufnahme nach dem Ersetzen gültig wäre – dazu wird der Stand
 * ohne die letzte Aufnahme berechnet.
 */
export function checkCorrection(
  config: MatchConfig,
  events: readonly MatchEvent[],
  score: number,
): VisitOutcome {
  const i = findLastIndex(events, (e) => e.type === 'visit');
  if (i < 0) return { ok: false, reason: 'gameOver' };
  const before = reduce(config, events.slice(0, i));
  return checkVisit(before, score);
}

function findLastIndex<T>(arr: readonly T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) return i;
  return -1;
}
