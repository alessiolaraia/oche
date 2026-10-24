import { create } from 'zustand';
import type { Question } from '../app/feedback';

export type FlashKind = 'accept' | 'reject' | 'info';

interface SessionStore {
  flash: { kind: FlashKind; text: string; id: number } | null;
  question: Question | null;
  /** Zeitpunkt der letzten Spracheingabe – für das „Nein“-Bestätigungsfenster. */
  lastVoiceInputAt: number;
  /** Intro vor dem Spiel läuft (Game zeigt es als Überlagerung). */
  intro: boolean;
  setIntro: (on: boolean) => void;
  showFlash: (kind: FlashKind, text: string) => void;
  clearFlash: () => void;
  setQuestion: (q: Question | null) => void;
  markVoiceInput: () => void;
}

let flashId = 0;

export const useSession = create<SessionStore>()((set) => ({
  flash: null,
  question: null,
  lastVoiceInputAt: 0,
  intro: false,
  setIntro: (intro) => set({ intro }),
  showFlash: (kind, text) => set({ flash: { kind, text, id: ++flashId } }),
  clearFlash: () => set({ flash: null }),
  setQuestion: (question) => set({ question }),
  markVoiceInput: () => set({ lastVoiceInputAt: Date.now() }),
}));
