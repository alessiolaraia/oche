import { usePlatform } from '../store/platform';

interface Sentinel extends EventTarget {
  released: boolean;
  release(): Promise<void>;
}
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

let sentinel: Sentinel | null = null;
let wanted = false;

function api(): WakeLockApi | null {
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock ?? null;
}

async function acquire() {
  const wl = api();
  if (!wl) {
    usePlatform.getState().set({ wakeLock: 'unsupported' });
    return;
  }
  if (sentinel && !sentinel.released) return;
  try {
    sentinel = await wl.request('screen');
    usePlatform.getState().set({ wakeLock: 'active' });
    sentinel.addEventListener('release', () =>
      usePlatform.getState().set({ wakeLock: wanted ? 'released' : 'off' }),
    );
  } catch {
    usePlatform.getState().set({ wakeLock: 'error' });
  }
}

/** Bildschirm anlassen (Screen Wake Lock); wird nach Tab-Wechsel automatisch neu angefordert. */
export function keepScreenOn(on: boolean): void {
  wanted = on;
  if (on) void acquire();
  else {
    void sentinel?.release();
    sentinel = null;
    usePlatform.getState().set({ wakeLock: api() ? 'off' : 'unsupported' });
  }
}

document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') void acquire();
});
