import { beginSpeaking, endSpeaking } from '../voice/echo';

export interface SpeakOptions {
  lang: string;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

export function ttsSupported(): boolean {
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
}

export function listVoices(): SpeechSynthesisVoice[] {
  return ttsSupported() ? speechSynthesis.getVoices() : [];
}

function pickVoice(lang: string, uri: string | null): SpeechSynthesisVoice | null {
  const voices = listVoices();
  if (uri) {
    const v = voices.find((x) => x.voiceURI === uri);
    if (v) return v;
  }
  const prefix = lang.slice(0, 2);
  return (
    voices.find((v) => v.lang === lang && v.localService) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

/** Spricht einen Text; Erkennung ist währenddessen stumm (Echo-Schutz). */
export function speak(text: string, o: SpeakOptions): Promise<void> {
  if (!ttsSupported() || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = o.lang;
    const v = pickVoice(o.lang, o.voiceURI);
    if (v) u.voice = v;
    u.rate = o.rate;
    u.pitch = o.pitch;
    u.volume = o.volume;
    let done = false;
    // Manche Browser feuern `end` nie – Sicherheitsnetz über die geschätzte Dauer
    const safety = setTimeout(finish, 1500 + (text.length * 90) / o.rate);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(safety);
      endSpeaking();
      resolve();
    }
    beginSpeaking();
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
  });
}

export function cancelSpeech(): void {
  if (ttsSupported()) speechSynthesis.cancel();
}

/** iOS/Safari: die erste Ausgabe muss aus einer Nutzergeste kommen. */
export function unlockSpeech(): void {
  if (!ttsSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}
