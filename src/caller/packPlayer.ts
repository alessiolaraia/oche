// Spielt Clips aus dem Oche-Klang-Paket (public/voices/oche-<lang>/) über Web Audio ab.
import { beginSpeaking, endSpeaking } from '../voice/echo';
import { audio } from './sfx';
import type { PackLang } from './voicepack';

export interface PackManifest {
  id: string;
  lang: PackLang;
  name: string;
  license: string;
  format: string;
  /** Schlüssel → Dauer in Sekunden */
  clips: Record<string, number>;
}

const baseUrl = (lang: PackLang) => `${import.meta.env.BASE_URL}voices/oche-${lang}/`;
const manifests = new Map<PackLang, Promise<PackManifest | null>>();
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;

export function loadManifest(lang: PackLang): Promise<PackManifest | null> {
  let p = manifests.get(lang);
  if (!p) {
    p = fetch(`${baseUrl(lang)}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PackManifest>) : null))
      .catch(() => null)
      .then((m) => {
        if (!m) manifests.delete(lang); // später erneut versuchen
        return m;
      });
    manifests.set(lang, p);
  }
  return p;
}

function buffer(lang: PackLang, key: string, ext: string): Promise<AudioBuffer | null> {
  const id = `${lang}/${key}`;
  let p = buffers.get(id);
  if (!p) {
    const ctx = audio();
    p = ctx
      ? fetch(`${baseUrl(lang)}${key}.${ext}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((data) => ctx.decodeAudioData(data))
          .catch(() => {
            buffers.delete(id);
            return null;
          })
      : Promise.resolve(null);
    buffers.set(id, p);
  }
  return p;
}

/** Lädt die Clips vorab, damit zwischen den Bausteinen keine Lücke entsteht. */
export function preload(lang: PackLang, m: PackManifest, keys: readonly string[]): Promise<unknown> {
  return Promise.all(keys.filter((k) => k in m.clips).map((k) => buffer(lang, k, m.format)));
}

/** Spielt einen Clip; false, wenn er fehlt oder nicht dekodiert werden kann (→ Systemstimme). */
export async function playClip(
  lang: PackLang,
  m: PackManifest,
  key: string,
  volume: number,
): Promise<boolean> {
  const ctx = audio();
  if (!ctx || !(key in m.clips)) return false;
  const buf = await buffer(lang, key, m.format);
  if (!buf) return false;
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    beginSpeaking();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (current === src) current = null;
      endSpeaking();
      resolve(true);
    };
    src.onended = finish;
    // Sicherheitsnetz, falls `ended` ausbleibt (Kontext angehalten)
    setTimeout(finish, buf.duration * 1000 + 800);
    current = src;
    src.start();
  });
}

export function stopClips(): void {
  try {
    current?.stop();
  } catch {
    /* schon beendet */
  }
  current = null;
}

/**
 * Lädt alle Clips einmal im Hintergrund, damit der Service Worker sie für offline speichert.
 * Läuft pro Paketversion nur einmal.
 */
export async function prefetchPack(lang: PackLang): Promise<void> {
  const m = await loadManifest(lang);
  if (!m) return;
  const keys = Object.keys(m.clips);
  const flag = `oche-pack-${m.id}-${keys.length}`;
  try {
    if (localStorage.getItem(flag)) return;
  } catch {
    return;
  }
  for (let i = 0; i < keys.length; i += 8) {
    await Promise.all(
      keys.slice(i, i + 8).map((k) => fetch(`${baseUrl(lang)}${k}.${m.format}`).catch(() => undefined)),
    );
  }
  try {
    localStorage.setItem(flag, String(Date.now()));
  } catch {
    /* privat-Modus */
  }
}
