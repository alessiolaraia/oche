import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type Settings } from '../settings/types';

type Section = Exclude<keyof Settings, 'onboarded'>;

interface SettingsStore extends Settings {
  update: <K extends Section>(section: K, patch: Partial<Settings[K]>) => void;
  setOnboarded: (v: boolean) => void;
  replace: (s: Settings) => void;
  reset: () => void;
}

/** Tiefe Zusammenführung mit den Defaults, damit neue Einstellungen in alten Speicherständen auftauchen. */
export function withDefaults(saved: Partial<Settings> | undefined): Settings {
  const s = saved ?? {};
  return {
    game: { ...DEFAULT_SETTINGS.game, ...s.game },
    players: { ...DEFAULT_SETTINGS.players, ...s.players },
    voice: {
      ...DEFAULT_SETTINGS.voice,
      ...s.voice,
      flags: { ...DEFAULT_SETTINGS.voice.flags, ...s.voice?.flags },
    },
    caller: { ...DEFAULT_SETTINGS.caller, ...s.caller },
    display: {
      ...DEFAULT_SETTINGS.display,
      ...s.display,
      // „Neon“ gibt es nicht mehr – wird zu „Feuer“
      ...((s.display?.arena as string | undefined) === 'neon' ? { arena: 'fire' as const } : {}),
    },
    onboarded: s.onboarded ?? DEFAULT_SETTINGS.onboarded,
  };
}

export function pickSettings(s: Settings): Settings {
  return {
    game: s.game,
    players: s.players,
    voice: s.voice,
    caller: s.caller,
    display: s.display,
    onboarded: s.onboarded,
  };
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (section, patch) =>
        set((st) => ({ [section]: { ...st[section], ...patch } }) as Partial<SettingsStore>),
      setOnboarded: (v) => set({ onboarded: v }),
      replace: (s) => set(withDefaults(s)),
      reset: () => set({ ...DEFAULT_SETTINGS, onboarded: true }),
    }),
    {
      name: 'oche-settings',
      version: 1,
      partialize: (s) => pickSettings(s),
      merge: (persisted, current) => ({ ...current, ...withDefaults(persisted as Partial<Settings>) }),
    },
  ),
);
