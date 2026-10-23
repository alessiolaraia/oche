import { create } from 'zustand';

export type WakeLockStatus = 'unsupported' | 'off' | 'active' | 'released' | 'error';

interface PlatformStore {
  wakeLock: WakeLockStatus;
  persisted: boolean | null;
  storageUsage: number | null;
  storageQuota: number | null;
  audioSession: string;
  set: (p: Partial<Omit<PlatformStore, 'set'>>) => void;
}

export const usePlatform = create<PlatformStore>()((set) => ({
  wakeLock: 'off',
  persisted: null,
  storageUsage: null,
  storageQuota: null,
  audioSession: 'unbekannt',
  set: (p) => set(p),
}));
