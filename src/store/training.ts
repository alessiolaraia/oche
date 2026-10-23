import { create } from 'zustand';
import { atcStart, type AtcState, type TrainingMode } from '../engine/training';

export interface RoundResult {
  target: number;
  success: boolean;
  darts: number;
}

interface TrainingStore {
  mode: TrainingMode | null;
  /** Aktuelles Ziel (Checkout/121). */
  target: number;
  /** Aufnahmen pro Versuch (Checkout: 1 = 3 Darts, 121: 3 = 9 Darts). */
  maxVisits: number;
  atc: AtcState;
  atcHistory: AtcState[];
  results: RoundResult[];
  set: (p: Partial<Omit<TrainingStore, 'set'>>) => void;
}

export const useTraining = create<TrainingStore>()((set) => ({
  mode: null,
  target: 0,
  maxVisits: 3,
  atc: atcStart(),
  atcHistory: [],
  results: [],
  set: (p) => set(p),
}));
