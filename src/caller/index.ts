import { onFeedback } from '../app/feedback';
import { useMatch } from '../store/match';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { announce } from './announce';
import { phrasebook } from './phrases';
import { playSfx, unlockSfx } from './sfx';
import { cancelSpeech, speak, unlockSpeech } from './tts';

let chain: Promise<void> = Promise.resolve();
let generation = 0;

/** Verbindet Spielereignisse mit Sprachausgabe und Soundeffekten. */
export function installCaller(): () => void {
  const unlock = () => {
    unlockSfx();
    unlockSpeech();
  };
  window.addEventListener('pointerdown', unlock, { once: true });

  const off = onFeedback((e) => {
    const c = useSettings.getState().caller;
    const a = announce(e, c, {
      state: useMatch.getState().state,
      askingAny: useSession.getState().question !== null,
    });
    if (!a) return;
    if (a.interrupt) {
      generation++;
      cancelSpeech();
      chain = Promise.resolve();
    }
    const gen = generation;
    const pb = phrasebook(c.style);
    chain = chain.then(async () => {
      if (gen !== generation) return;
      if (a.sfx) await playSfx(a.sfx);
      if (gen !== generation || !a.text) return;
      await speak(a.text, {
        lang: pb.lang,
        voiceURI: c.style === 'arena' ? c.voiceURIEn : c.voiceURI,
        rate: c.rate,
        pitch: c.pitch,
        volume: c.volume,
      });
    });
  });
  return () => {
    off();
    window.removeEventListener('pointerdown', unlock);
  };
}

/** Probe hören (Einstellungen). */
export function previewVoice(): void {
  const c = useSettings.getState().caller;
  const pb = phrasebook(c.style);
  cancelSpeech();
  void speak([pb.score(140), pb.require(121)].join(' '), {
    lang: pb.lang,
    voiceURI: c.style === 'arena' ? c.voiceURIEn : c.voiceURI,
    rate: c.rate,
    pitch: c.pitch,
    volume: c.volume,
  });
}
