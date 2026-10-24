import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CricketDart } from '../engine/cricket';

// Cricket-Partie: nur Spielernamen und Würfe (Event-Sourcing), der Stand wird daraus berechnet.
interface CricketStore {
  names: string[];
  events: (CricketDart | null)[];
  start: (names: string[]) => void;
  dart: (d: CricketDart) => void;
  endVisit: () => void;
  undo: () => void;
  close: () => void;
}

export const useCricket = create<CricketStore>()(
  persist(
    (set) => ({
      names: [],
      events: [],
      start: (names) => set({ names, events: [] }),
      dart: (d) => set((s) => ({ events: [...s.events, d] })),
      endVisit: () => set((s) => ({ events: [...s.events, null] })),
      undo: () => set((s) => ({ events: s.events.slice(0, -1) })),
      close: () => set({ names: [], events: [] }),
    }),
    { name: 'oche-cricket' },
  ),
);
