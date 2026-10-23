// Wird in Phase 4 durch die echte Sprachsteuerung ersetzt.
import { useVoice } from '../store/voice';

export async function startVoice(): Promise<void> {
  useVoice.getState().set({ status: 'listening' });
}

export function stopVoice(): void {
  useVoice.getState().set({ status: 'off' });
}

export function setPaused(paused: boolean): void {
  useVoice.getState().set({ status: paused ? 'paused' : 'listening' });
}
