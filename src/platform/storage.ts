import { usePlatform } from '../store/platform';

/** Bittet den Browser, Daten (Modell, Statistik) nicht automatisch zu löschen. */
export async function requestPersistentStorage(): Promise<void> {
  const s = navigator.storage;
  if (!s?.persist) return;
  const persisted = (await s.persisted()) || (await s.persist());
  usePlatform.getState().set({ persisted });
  await refreshStorageEstimate();
}

export async function refreshStorageEstimate(): Promise<void> {
  const s = navigator.storage;
  if (!s?.estimate) return;
  const e = await s.estimate();
  usePlatform.getState().set({
    storageUsage: e.usage ?? null,
    storageQuota: e.quota ?? null,
    persisted: s.persisted ? await s.persisted() : null,
  });
}
