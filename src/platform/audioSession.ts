import { usePlatform } from '../store/platform';

type AudioSessionApi = { type: string };

/**
 * iOS/Safari: bei offenem Mikro sonst leise Sprachausgabe. „play-and-record“ hält beide Richtungen laut.
 * Nur wenn verfügbar (Feature-Detection).
 */
export function configureAudioSession(): void {
  const session = (navigator as Navigator & { audioSession?: AudioSessionApi }).audioSession;
  if (!session) {
    usePlatform.getState().set({ audioSession: 'nicht verfügbar' });
    return;
  }
  try {
    session.type = 'play-and-record';
    usePlatform.getState().set({ audioSession: session.type });
  } catch {
    usePlatform.getState().set({ audioSession: 'Fehler' });
  }
}
