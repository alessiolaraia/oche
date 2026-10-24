import { describe, expect, it } from 'vitest';
import {
  applyDart,
  cricketStart,
  endVisit,
  marksPerRound,
  reduceCricket,
  validDart,
  type CricketDart,
  type CricketTarget,
} from '../../src/engine/cricket';

const d = (target: CricketTarget, marks: number): CricketDart => ({ target, marks });
const miss: CricketDart = { target: 0, marks: 0 };

describe('Cricket', () => {
  it('Marks: Single 1, Double 2, Triple 3 – drei Marks schließen', () => {
    let s = cricketStart(2);
    s = applyDart(s, d(20, 1));
    s = applyDart(s, d(20, 2));
    expect(s.players[0]!.marks[20]).toBe(3);
    expect(s.players[0]!.points).toBe(0);
  });

  it('Überzählige Marks punkten, solange der Gegner offen ist', () => {
    let s = cricketStart(2);
    s = applyDart(s, d(20, 3)); // zu
    s = applyDart(s, d(20, 3)); // +60
    expect(s.players[0]!.points).toBe(60);
    // Triple 20 mit nur 2 fehlenden Marks: 2 schließen, 1 punktet
    let t = cricketStart(2);
    t = applyDart(t, d(19, 1));
    t = applyDart(t, d(19, 3));
    expect(t.players[0]!.marks[19]).toBe(3);
    expect(t.players[0]!.points).toBe(19);
  });

  it('Hat der Gegner das Ziel auch geschlossen, gibt es keine Punkte mehr', () => {
    const s = reduceCricket(2, [d(20, 3), null, d(20, 3), null, d(20, 3)]);
    expect(s.players[0]!.points).toBe(0);
    expect(s.players[1]!.points).toBe(0);
  });

  it('Nach drei Darts wechselt der Spieler, Aufnahme kann vorzeitig enden', () => {
    let s = cricketStart(2);
    s = applyDart(s, miss);
    s = applyDart(s, miss);
    expect(s.current).toBe(0);
    s = applyDart(s, miss);
    expect(s.current).toBe(1);
    s = endVisit(s);
    expect(s.current).toBe(0);
    expect(s.round).toBe(2);
  });

  it('Bull: außen 1, innen 2 Marks, je 25 Punkte; Triple-Bull gibt es nicht', () => {
    expect(validDart(d(25, 3))).toBe(false);
    let s = cricketStart(2);
    s = applyDart(s, d(25, 2));
    s = applyDart(s, d(25, 2)); // 1 schließt, 1 punktet
    expect(s.players[0]!.marks[25]).toBe(3);
    expect(s.players[0]!.points).toBe(25);
  });

  it('Gewonnen: alles geschlossen und mindestens gleich viele Punkte', () => {
    const closeAll: (CricketDart | null)[] = [];
    // Spieler A schließt alles in 7 Aufnahmen (je ein Triple), B wirft daneben
    for (const t of [20, 19, 18, 17, 16, 15] as const) closeAll.push(d(t, 3), null, null);
    closeAll.push(d(25, 2), d(25, 1));
    const s = reduceCricket(2, closeAll);
    expect(s.winner).toBe(0);
  });

  it('Alles zu, aber weniger Punkte als der Gegner → noch nicht gewonnen', () => {
    // B punktet erst auf 20 (A ist dort noch offen), dann schließt A alles
    const ev: (CricketDart | null)[] = [null, d(20, 3), d(20, 3), d(20, 3)];
    for (const t of [20, 19, 18, 17, 16, 15] as const) ev.push(d(t, 3), null, null);
    ev.push(d(25, 2), d(25, 1));
    const s = reduceCricket(2, ev);
    expect(s.players[1]!.points).toBe(120);
    expect(s.winner).toBeNull();
  });

  it('MPR (Marks pro Aufnahme)', () => {
    const ev = [d(20, 3), d(19, 3), miss, null, d(18, 1), null];
    expect(marksPerRound(ev, 2, 0)).toBe(3.5);
  });
});
