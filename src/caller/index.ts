import { onFeedback } from '../app/feedback';
import { useMatch } from '../store/match';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { announce, type Announcement } from './announce';
import { loadManifest, playClip, prefetchPack, preload, stopClips, variant } from './packPlayer';
import { phrasebook, type Cue } from './phrases';
import { playSfx, unlockSfx } from './sfx';
import { cancelSpeech, speak, unlockSpeech } from './tts';
import type { PackLang } from './voicepack';

let chain: Promise<void> = Promise.resolve();
let generation = 0;

const packLang = (style: 'plain' | 'arena'): PackLang => (style === 'arena' ? 'en' : 'de');

/** Spielt eine Ansage: Effekt, dann Bausteine – Clip aus dem Paket, sonst Systemstimme. */
function perform(a: Announcement): void {
  const c = useSettings.getState().caller;
  if (a.interrupt) {
    generation++;
    cancelSpeech();
    stopClips();
    chain = Promise.resolve();
  }
  const gen = generation;
  const pb = phrasebook(c.style);
  const lang = packLang(c.style);
  const speakOpts = {
    lang: pb.lang,
    voiceURI: c.style === 'arena' ? c.voiceURIEn : c.voiceURI,
    rate: c.rate,
    pitch: c.pitch,
    volume: c.volume,
  };
  chain = chain.then(async () => {
    if (gen !== generation) return;
    const m = c.voiceSource === 'pack' && a.cues.length ? await loadManifest(lang) : null;
    // Paket-Modus: Namen weglassen, bei mehreren Takes einen auswählen
    const cues: Cue[] = m
      ? a.cues.filter((q) => !q.name).map((q) => (q.key ? { ...q, key: variant(m, q.key) } : q))
      : a.cues;
    // Clips laden, während der Effekt läuft
    const loading = m
      ? preload(
          lang,
          m,
          cues.flatMap((q) => (q.key ? [q.key] : [])),
        )
      : null;
    if (a.sfx) await playSfx(a.sfx);
    await loading;
    let text: string[] = [];
    const flush = async () => {
      if (text.length && gen === generation) await speak(text.join(' '), speakOpts);
      text = [];
    };
    for (const q of cues) {
      if (gen !== generation) return;
      if (m && q.key) {
        await flush();
        if (await playClip(lang, m, q.key, c.volume)) continue;
      }
      text.push(q.text);
    }
    await flush();
  });
}

/** Verbindet Spielereignisse mit Sprachausgabe und Soundeffekten. */
export function installCaller(): () => void {
  const unlock = () => {
    unlockSfx();
    unlockSpeech();
  };
  window.addEventListener('pointerdown', unlock, { once: true });

  // Klang-Paket im Hintergrund vollständig laden (offline verfügbar)
  const c = useSettings.getState().caller;
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 3000));
  if (c.voiceSource === 'pack') idle(() => void prefetchPack(packLang(c.style)));

  const off = onFeedback((e) => {
    const a = announce(e, useSettings.getState().caller, {
      state: useMatch.getState().state,
      askingAny: useSession.getState().question !== null,
    });
    if (a) perform(a);
  });
  return () => {
    off();
    window.removeEventListener('pointerdown', unlock);
  };
}

/** Probe hören (Einstellungen): eine 140 und „Du brauchst 121“ im gewählten Stil. */
export function previewVoice(): void {
  const c = useSettings.getState().caller;
  const pb = phrasebook(c.style);
  const cues = [...pb.score(140), ...pb.require(121)];
  perform({ cues, text: cues.map((q) => q.text).join(' '), sfx: null, interrupt: true });
}
