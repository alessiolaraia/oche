import { describe, expect, it } from 'vitest';
import { annotateLast, checkCorrection, correctLast, reduce, undoLast } from '../../src/engine/x01';
import type { MatchConfig, MatchEvent } from '../../src/engine/types';

let n = 0;
const v = (score: number, extra: Partial<Extract<MatchEvent, { type: 'visit' }>> = {}): MatchEvent => ({
  type: 'visit',
  id: `e${++n}`,
  score,
  ts: n,
  ...extra,
});

const twoPlayers = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  startScore: 501,
  inMode: 'straight',
  outMode: 'double',
  legs: { mode: 'firstTo', count: 3 },
  sets: null,
  players: [
    { id: 'a', name: 'Anna' },
    { id: 'b', name: 'Ben' },
  ],
  startOrder: 'alternate',
  ...over,
});

/** Ein 501-Leg in 9 Darts für den Starter, Gegner wirft jeweils 60. */
function nineDarter(): MatchEvent[] {
  return [v(180), v(60), v(180), v(60), v(141, { dartsUsed: 3 })];
}

describe('X01-Engine', () => {
  it('Startzustand', () => {
    const s = reduce(twoPlayers(), []);
    expect(s.players.map((p) => p.remaining)).toEqual([501, 501]);
    expect(s.current).toBe(0);
    expect(s.winner).toBeNull();
  });

  it('Aufnahmen wechseln den Spieler und ziehen ab', () => {
    const s = reduce(twoPlayers(), [v(60), v(45)]);
    expect(s.players.map((p) => p.remaining)).toEqual([441, 456]);
    expect(s.current).toBe(0);
    expect(s.lastVisit).toMatchObject({ player: 1, scored: 45, remainingAfter: 456 });
  });

  it('Bust: Rest bleibt, Aufnahme zählt 0', () => {
    const cfg = twoPlayers({ startScore: 101 });
    const s = reduce(cfg, [v(60), v(0), v(60)]);
    expect(s.players[0]!.remaining).toBe(41);
    expect(s.lastVisit).toMatchObject({ bust: true, scored: 0, darts: 3 });
    expect(s.current).toBe(1);
  });

  it('Rest 1 → Bust', () => {
    const s = reduce(twoPlayers({ startScore: 101 }), [v(60), v(0), v(40)]);
    expect(s.players[0]!.remaining).toBe(41);
    expect(s.lastVisit!.bust).toBe(true);
  });

  it('angesagtes Überworfen', () => {
    const s = reduce(twoPlayers(), [v(0, { bust: true })]);
    expect(s.players[0]!.remaining).toBe(501);
    expect(s.lastVisit!.bust).toBe(true);
  });

  it('ungültige Aufnahmen werden ignoriert', () => {
    const s = reduce(twoPlayers(), [v(179), v(200)]);
    expect(s.players[0]!.remaining).toBe(501);
    expect(s.current).toBe(0);
  });

  it('Checkout gewinnt das Leg, nächstes Leg beginnt der andere Spieler', () => {
    const s = reduce(twoPlayers(), nineDarter());
    expect(s.players.map((p) => p.legsWon)).toEqual([1, 0]);
    expect(s.players.map((p) => p.remaining)).toEqual([501, 501]);
    expect(s.legNumber).toBe(2);
    expect(s.legStarter).toBe(1);
    expect(s.current).toBe(1);
    expect(s.legs[0]!.visits.at(-1)).toMatchObject({ checkout: true, darts: 3 });
  });

  it('First to 3 Legs: Match endet nach dem dritten Leg', () => {
    // Leg 1: A beginnt; Leg 2: B beginnt (B wirft 60er, A checkt); Leg 3: A beginnt
    const leg2 = [v(60), v(180), v(60), v(180), v(60), v(141)];
    const s = reduce(twoPlayers(), [...nineDarter(), ...leg2, ...nineDarter()]);
    expect(s.winner).toBe(0);
    expect(s.players[0]!.legsWon).toBe(3);
    // Nach Matchende keine weiteren Aufnahmen
    const after = reduce(twoPlayers(), [...nineDarter(), ...leg2, ...nineDarter(), v(60)]);
    expect(after.legs.flatMap((l) => l.visits)).toHaveLength(s.legs.flatMap((l) => l.visits).length);
  });

  it('Sets: First to 2 Sets à First to 2 Legs', () => {
    const cfg = twoPlayers({ legs: { mode: 'firstTo', count: 2 }, sets: { mode: 'firstTo', count: 2 } });
    const legA = (aStarts: boolean) =>
      aStarts ? nineDarter() : [v(60), v(180), v(60), v(180), v(60), v(141)];
    // Starter rotiert: Leg1 A, Leg2 B, Leg3 A, Leg4 B
    const s1 = reduce(cfg, [...legA(true), ...legA(false)]);
    expect(s1.players[0]!.setsWon).toBe(1);
    expect(s1.players[0]!.legsWon).toBe(0);
    expect(s1.setNumber).toBe(2);
    const s2 = reduce(cfg, [...legA(true), ...legA(false), ...legA(true), ...legA(false)]);
    expect(s2.winner).toBe(0);
  });

  it('Bull-Out bestimmt den Starter', () => {
    const s = reduce(twoPlayers({ startOrder: 'bullOut' }), [
      { type: 'starter', id: 's', player: 1, ts: 0 },
      v(60),
    ]);
    expect(s.players[1]!.remaining).toBe(441);
    expect(s.matchStarter).toBe(1);
  });

  it('Undo entfernt die letzte Aufnahme – auch über ein Leg-Ende hinweg', () => {
    const ev = nineDarter();
    const s = reduce(twoPlayers(), undoLast(ev));
    expect(s.players[0]!.remaining).toBe(141);
    expect(s.players[0]!.legsWon).toBe(0);
    expect(s.current).toBe(0);
  });

  it('Korrektur ersetzt die letzte Aufnahme', () => {
    const ev = [v(60), v(45)];
    const s = reduce(twoPlayers(), correctLast(ev, { score: 85 }));
    expect(s.players[1]!.remaining).toBe(416);
    expect(checkCorrection(twoPlayers(), ev, 179)).toMatchObject({ ok: false });
  });

  it('Checkout-Details nachtragen', () => {
    const ev = annotateLast(nineDarter(), { dartsUsed: 3, dartsAtDouble: 1 });
    const s = reduce(twoPlayers(), ev);
    expect(s.legs[0]!.visits.at(-1)).toMatchObject({ darts: 3, dartsAtDouble: 1 });
  });

  it('Checkout mit zu wenigen Darts wird ignoriert (141 geht nicht mit 2 Darts)', () => {
    const s = reduce(twoPlayers(), annotateLast(nineDarter(), { dartsUsed: 2 }));
    expect(s.players[0]!.legsWon).toBe(0);
    expect(s.players[0]!.remaining).toBe(141);
  });

  it('Neues Leg setzt die Reste zurück', () => {
    const s = reduce(twoPlayers(), [v(100), v(100), { type: 'restartLeg', id: 'r', ts: 1 }]);
    expect(s.players.map((p) => p.remaining)).toEqual([501, 501]);
    expect(s.current).toBe(0);
  });

  it('Double-In: erst eine Aufnahme > 0 bringt den Spieler ins Spiel', () => {
    const cfg = twoPlayers({ inMode: 'double' });
    const s = reduce(cfg, [v(0), v(40), v(60)]);
    expect(s.players[0]!.isIn).toBe(true);
    expect(s.players[0]!.remaining).toBe(441);
    expect(s.players[1]!.remaining).toBe(461);
  });

  it('1 Spieler (Solo) und 8 Spieler', () => {
    const solo = reduce(twoPlayers({ players: [{ id: 'a', name: 'A' }] }), [v(60), v(60)]);
    expect(solo.players[0]!.remaining).toBe(381);
    const eight = twoPlayers({
      players: Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, name: `P${i}` })),
    });
    expect(
      reduce(
        eight,
        Array.from({ length: 8 }, () => v(60)),
      ).current,
    ).toBe(0);
    expect(() => reduce(twoPlayers({ players: [] }), [])).toThrow();
  });
});
