// Cricket als reine Funktionen (Event-Sourcing wie X01): Zustand = reduceCricket(Spieler, Darts).
// Ziele 15–20 und Bull. Single/Double/Triple = 1/2/3 Marks, Bull außen 1, innen 2. Drei Marks schließen ein Ziel;
// weitere Treffer zählen Punkte, solange ein Gegner das Ziel noch offen hat. Gewonnen hat, wer alle Ziele
// geschlossen hat und mindestens so viele Punkte hat wie jeder Gegner.

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
export type CricketTarget = (typeof CRICKET_TARGETS)[number];

/** Ein Dart: Ziel + Marks (1–3, Bull 1–2) oder Fehlwurf (`target: 0`). */
export interface CricketDart {
  target: CricketTarget | 0;
  marks: number;
}

export interface CricketPlayerState {
  marks: Record<CricketTarget, number>;
  points: number;
}

export interface CricketState {
  players: CricketPlayerState[];
  current: number;
  /** Darts des Spielers am Zug in dieser Aufnahme. */
  visit: CricketDart[];
  round: number;
  winner: number | null;
}

const emptyMarks = (): Record<CricketTarget, number> => ({ 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 });

export function cricketStart(playerCount: number): CricketState {
  return {
    players: Array.from({ length: playerCount }, () => ({ marks: emptyMarks(), points: 0 })),
    current: 0,
    visit: [],
    round: 1,
    winner: null,
  };
}

export function isClosed(p: CricketPlayerState, t: CricketTarget): boolean {
  return p.marks[t] >= 3;
}

function allClosed(p: CricketPlayerState): boolean {
  return CRICKET_TARGETS.every((t) => isClosed(p, t));
}

/** Gültiger Dart? Triple-Bull gibt es nicht. */
export function validDart(d: CricketDart): boolean {
  if (d.target === 0) return d.marks === 0;
  const max = d.target === 25 ? 2 : 3;
  return Number.isInteger(d.marks) && d.marks >= 1 && d.marks <= max;
}

/** Einen Dart werfen. Nach drei Darts ist der nächste Spieler dran. */
export function applyDart(s: CricketState, d: CricketDart): CricketState {
  if (s.winner !== null || !validDart(d)) return s;
  const players = s.players.map((p) => ({ marks: { ...p.marks }, points: p.points }));
  const me = players[s.current]!;
  if (d.target !== 0) {
    for (let i = 0; i < d.marks; i++) {
      if (!isClosed(me, d.target)) me.marks[d.target]++;
      else if (players.some((p, k) => k !== s.current && !isClosed(p, d.target as CricketTarget)))
        me.points += d.target;
    }
  }
  const visit = [...s.visit, d];
  const winner =
    allClosed(me) && players.every((p, k) => k === s.current || me.points >= p.points) ? s.current : null;
  if (winner !== null) return { ...s, players, visit, winner };
  if (visit.length < 3) return { ...s, players, visit };
  return nextPlayer({ ...s, players, visit });
}

/** Aufnahme vorzeitig beenden (restliche Darts = Fehlwürfe). */
export function endVisit(s: CricketState): CricketState {
  if (s.winner !== null) return s;
  return nextPlayer(s);
}

function nextPlayer(s: CricketState): CricketState {
  const current = (s.current + 1) % s.players.length;
  return { ...s, current, visit: [], round: current === 0 ? s.round + 1 : s.round };
}

/** Event-Sourcing: Zustand aus der Liste aller Würfe (`null` = Aufnahme beendet). */
export function reduceCricket(playerCount: number, events: readonly (CricketDart | null)[]): CricketState {
  return events.reduce<CricketState>(
    (s, e) => (e === null ? endVisit(s) : applyDart(s, e)),
    cricketStart(playerCount),
  );
}

/** Marks pro Aufnahme (MPR) – die übliche Cricket-Statistik. */
export function marksPerRound(
  events: readonly (CricketDart | null)[],
  playerCount: number,
  player: number,
): number {
  let s = cricketStart(playerCount);
  let marks = 0;
  let visits = 0;
  let counted = false;
  for (const e of events) {
    if (s.winner !== null) break;
    const who = s.current;
    if (who === player && !counted) {
      visits++;
      counted = true;
    }
    if (e && who === player) marks += e.marks;
    s = e === null ? endVisit(s) : applyDart(s, e);
    if (s.current !== who) counted = false;
  }
  return visits ? marks / visits : 0;
}

export function cricketLabel(t: CricketTarget): string {
  return t === 25 ? 'Bull' : String(t);
}
