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

export interface TrainingResult {
  id: string;
  mode: 'atc' | 'checkout' | '121';
  at: number;
  /** Ziel (Checkout/121) bzw. 0 bei Around the Clock. */
  target: number;
  success: boolean;
  /** Benötigte Darts. */
  darts: number;
}

export interface CurrentMatch {
  key: 'current';
  matchId: string;
}

class OcheDb extends Dexie {
  matches!: EntityTable<StoredMatch, 'id'>;
  meta!: EntityTable<CurrentMatch, 'key'>;
  trainings!: EntityTable<TrainingResult, 'id'>;

  constructor() {
    super('oche');
    this.version(1).stores({
      matches: 'id, startedAt, finishedAt, kind',
      meta: 'key',
    });
    this.version(2).stores({ trainings: 'id, mode, at' });
  }
}

export const db = new OcheDb();
