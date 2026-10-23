import Dexie, { type EntityTable } from 'dexie';
import type { MatchConfig, MatchEvent } from '../engine/types';

export interface StoredMatch {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  config: MatchConfig;
  events: MatchEvent[];
  winner: number | null;
  /** 'x01' oder ein Trainingsmodus */
  kind: string;
}

export interface CurrentMatch {
  key: 'current';
  matchId: string;
}

class OcheDb extends Dexie {
  matches!: EntityTable<StoredMatch, 'id'>;
  meta!: EntityTable<CurrentMatch, 'key'>;

  constructor() {
    super('oche');
    this.version(1).stores({
      matches: 'id, startedAt, finishedAt, kind',
      meta: 'key',
    });
  }
}

export const db = new OcheDb();
