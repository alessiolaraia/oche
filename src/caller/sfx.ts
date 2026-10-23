// Selbst erzeugte Soundeffekte (Web Audio), keine fremden Samples.
import { beginSpeaking, endSpeaking } from '../voice/echo';
import type { Sfx } from './announce';

let ctx: AudioContext | null = null;

/** Gemeinsamer AudioContext für Effekte und Klang-Paket. */
export function audio(): AudioContext | null {
  if (typeof AudioContext !== 'function') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockSfx(): void {
  audio();
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'triangle',
  gain = 0.25,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function noiseBurst(c: AudioContext, start: number, dur: number, gain = 0.15) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

const C5 = 523.25;
const note = (semi: number) => C5 * 2 ** (semi / 12);

/** Spielt einen Effekt und gibt seine Dauer in Sekunden zurück. */
function render(c: AudioContext, s: Sfx): number {
  switch (s) {
    case 'accept':
      tone(c, note(7), 0, 0.08, 'sine', 0.2);
      return 0.1;
    case 'notUnderstood':
      tone(c, note(-10), 0, 0.12, 'square', 0.08);
      tone(c, note(-13), 0.16, 0.18, 'square', 0.08);
      return 0.36;
    case 'bust':
      [0, -3, -6].forEach((s2, i) => tone(c, note(s2 - 5), i * 0.12, 0.16, 'sawtooth', 0.09));
      return 0.5;
    case 'ton':
      tone(c, note(0), 0, 0.12);
      tone(c, note(7), 0.1, 0.2);
      return 0.32;
    case 'leg':
      [0, 4, 7].forEach((s2, i) => tone(c, note(s2), i * 0.09, 0.25));
      return 0.45;
    case 'maximum':
      noiseBurst(c, 0, 0.6, 0.12);
      [0, 4, 7, 12, 16].forEach((s2, i) => tone(c, note(s2), i * 0.07, 0.35, 'triangle', 0.22));
      return 0.75;
    case 'highFinish':
      [0, 4, 7, 12].forEach((s2, i) => tone(c, note(s2), i * 0.11, 0.3, 'triangle', 0.22));
      tone(c, note(19), 0.5, 0.5, 'sine', 0.18);
      return 1;
    case 'match':
      noiseBurst(c, 0, 1.2, 0.1);
      [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s2, i) => tone(c, note(s2), i * 0.1, 0.4, 'triangle', 0.2));
      return 1.4;
  }
}

/** Spielt den Effekt; Erkennung ist währenddessen stumm. */
export function playSfx(s: Sfx): Promise<void> {
  const c = audio();
  if (!c) return Promise.resolve();
  const dur = render(c, s);
  beginSpeaking();
  return new Promise((resolve) =>
    setTimeout(() => {
      endSpeaking();
      resolve();
    }, dur * 1000),
  );
}
