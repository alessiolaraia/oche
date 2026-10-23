import { create } from 'zustand';
import { db } from '../db/db';
import { reduce } from '../engine/x01';
import type { MatchConfig, MatchEvent, MatchState } from '../engine/types';

export type MatchKind = 'x01' | 'checkout' | '121';

interface MatchStore {
  matchId: string | null;
  kind: MatchKind;
  startedAt: number;
  config: MatchConfig | null;
  events: MatchEvent[];
  state: MatchState | null;
  start: (config: MatchConfig, kind?: MatchKind) => MatchState;
  setEvents: (events: MatchEvent[]) => MatchState;
  resume: () => Promise<boolean>;
  close: () => void;
}

export function newId(): string {
  return crypto.randomUUID();
}

async function persist(
  s: Pick<MatchStore, 'matchId' | 'kind' | 'startedAt' | 'config' | 'events' | 'state'>,
) {
  if (!s.matchId || !s.config || !s.state) return;
  const finished = s.state.winner !== null;
  await db.matches.put({
    id: s.matchId,
    startedAt: s.startedAt,
    finishedAt: finished ? Date.now() : null,
    config: s.config,
    events: s.events,
    winner: s.state.winner,
    kind: s.kind,
  });
  // Trainingsrunden werden nicht als „laufendes Spiel“ fortgesetzt
  if (finished || s.kind !== 'x01') await db.meta.delete('current');
  else await db.meta.put({ key: 'current', matchId: s.matchId });
}

export const useMatch = create<MatchStore>()((set, get) => ({
  matchId: null,
  kind: 'x01',
  startedAt: 0,
  config: null,
  events: [],
  state: null,
  start: (config, kind = 'x01') => {
    const state = reduce(config, []);
    const next = { matchId: newId(), kind, startedAt: Date.now(), config, events: [], state };
    set(next);
    void persist(next);
    return state;
  },
  setEvents: (events) => {
    const { config } = get();
    if (!config) throw new Error('Kein Match aktiv');
    const state = reduce(config, events);
    set({ events, state });
    void persist({ ...get(), events, state });
    return state;
  },
  resume: async () => {
    const cur = await db.meta.get('current');
    if (!cur) return false;
    const m = await db.matches.get(cur.matchId);
    if (!m || m.finishedAt || m.kind !== 'x01') return false;
    set({
      matchId: m.id,
      kind: 'x01',
      startedAt: m.startedAt,
      config: m.config,
      events: m.events,
      state: reduce(m.config, m.events),
    });
    return true;
  },
  close: () => {
    void db.meta.delete('current');
    set({ matchId: null, kind: 'x01', config: null, events: [], state: null });
  },
}));
