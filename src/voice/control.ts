// Sprachsteuerung: startet Engine + Audio-Pipeline, wertet Transkripte aus und ruft den Controller auf.
import { submitVisit, undo } from '../app/controller';
import { emitFeedback } from '../app/feedback';
import { configureAudioSession } from '../platform/audioSession';
import { requestPersistentStorage } from '../platform/storage';
import { useSettings } from '../store/settings';
import { useVoice } from '../store/voice';
import { AudioPipeline, type Level } from './audio/pipeline';
import { buildGrammar, type Command } from './commands';
import { decide } from './decide/decide';
import { isEchoMuted, onEchoMute } from './echo';
import type { SpeechEngine, Transcript } from './engine';
import { normalizeTokens } from './lexicon.de';
import { tokenize } from './numbers.de';
import { loadVocab } from './vocab';
import { VoskEngine } from './voskEngine';
import { WebSpeechEngine, webSpeechSupported } from './webSpeechEngine';

let engine: SpeechEngine | null = null;
let pipeline: AudioPipeline | null = null;
let starting = false;
/** Zählt Start/Stopp: ein Start, der während des Ladens gestoppt wurde, darf das Mikro nicht mehr öffnen. */
let generation = 0;

class Cancelled extends Error {}
const check = (gen: number) => {
  if (gen !== generation) throw new Cancelled();
};
let paused = false;
const levelListeners = new Set<(l: Level) => void>();

export function voskSupported(): boolean {
  return (
    typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof AudioWorkletNode === 'function'
  );
}

export function getPipeline(): AudioPipeline | null {
  return pipeline;
}

/** Pegel einer fremden (temporären) Pipeline an die Abonnenten weiterreichen. */
export function forwardLevels(l: Level): void {
  for (const fn of levelListeners) fn(l);
  voice().set({ level: levelToUnit(l.db), inputDb: l.db, gateOpen: l.gateOpen });
}

/** Für Kalibrierung und Pegelanzeige: rohe Pegel-Ereignisse abonnieren. */
export function onLevel(l: (level: Level) => void): () => void {
  levelListeners.add(l);
  return () => levelListeners.delete(l);
}

const voice = () => useVoice.getState();

function levelToUnit(db: number): number {
  return Math.max(0, Math.min(1, (db + 60) / 50));
}

async function startPipeline(): Promise<AudioPipeline> {
  const v = useSettings.getState().voice;
  const p = await AudioPipeline.create({
    gainDb: v.gainDb,
    gateDb: v.gateDb,
    noiseSuppression: v.noiseSuppression,
    autoGainControl: v.autoGainControl,
    dsp2: v.flags.dsp2,
    voiceIsolation: true,
  });
  p.setMuted(isEchoMuted());
  p.onLevel = (l) => {
    for (const fn of levelListeners) fn(l);
    const s = voice();
    const status =
      s.status === 'listening' || s.status === 'hearing'
        ? l.gateOpen || s.partial
          ? 'hearing'
          : 'listening'
        : s.status;
    s.set({ level: levelToUnit(l.db), inputDb: l.db, gateOpen: l.gateOpen, status });
  };
  p.onInterrupt = (interrupted) => {
    if (interrupted)
      voice().set({ status: 'paused', error: 'Mikrofon unterbrochen (Anruf oder andere App?)' });
    else {
      voice().set({ status: paused ? 'paused' : 'listening', error: null });
      void p.resume();
    }
  };
  voice().set({ sampleRate: p.sampleRate });
  return p;
}

function currentGrammar(vocab: ReadonlySet<string>): string[] {
  const v = useSettings.getState().voice;
  const grammar = buildGrammar({ trigger: v.trigger, vocab, aliases: v.aliases });
  const triggerOk = vocab.has(v.trigger.toLowerCase());
  const warnings: string[] = [];
  if (!triggerOk)
    warnings.push(`Das Triggerwort „${v.trigger}“ kennt das Sprachmodell nicht. Wähle ein anderes.`);
  voice().set({ warnings });
  return grammar;
}

async function startVosk(gen: number): Promise<void> {
  const p = await startPipeline();
  if (gen !== generation) {
    p.stop();
    throw new Cancelled();
  }
  pipeline = p;
  voice().set({ modelProgress: 'Sprachmodell wird geladen (45 MB, nur beim ersten Mal) …' });
  const vocab = await loadVocab();
  check(gen);
  const e = new VoskEngine(currentGrammar(vocab));
  wire(e);
  await e.start();
  if (gen !== generation) {
    e.stop();
    throw new Cancelled();
  }
  engine = e;
  pipeline.onChunk = (pcm) => e.feed(pcm);
  voice().set({ modelProgress: null, engine: 'vosk' });
}

async function startWebSpeech(gen: number): Promise<void> {
  const e = new WebSpeechEngine();
  wire(e);
  await e.start();
  if (gen !== generation) {
    e.stop();
    throw new Cancelled();
  }
  engine = e;
  voice().set({ engine: 'webspeech', warnings: [] });
}

const ARMED_MS = 4000;

/** Rand leuchten lassen, sobald das Triggerwort (Direkt-Modus: irgendeine Sprache) zu hören ist. */
function markArmed(text: string): void {
  const v = useSettings.getState().voice;
  // schon im laufenden Teilergebnis – sobald das Wort fällt, auch nach „äh“ oder Störgeräusch davor
  const t = normalizeTokens(tokenize(text));
  if (t.length === 0) return;
  const heardTrigger = v.mode === 'direct' || t.slice(0, 3).includes(v.trigger.toLowerCase());
  if (heardTrigger) voice().set({ armedUntil: Date.now() + ARMED_MS });
}

/** Nach einer Entscheidung den Rand kurz ausklingen lassen. */
function disarm(): void {
  voice().set({ armedUntil: Math.min(voice().armedUntil, Date.now() + 500) });
}

function wire(e: SpeechEngine) {
  e.onTranscript = handleTranscript;
  e.onPartial = (text) => {
    const s = voice();
    s.set({ partial: text, status: s.status === 'listening' && text ? 'hearing' : s.status });
    if (text && !isEchoMuted()) markArmed(text);
  };
  e.onError = (message) => voice().set({ error: message });
}

/** Mikro und Erkennung starten – muss aus einer Nutzeraktion (Tippen) heraus aufgerufen werden. */
export async function startVoice(): Promise<void> {
  if (engine || starting) return;
  starting = true;
  const gen = ++generation;
  paused = false;
  voice().set({ status: 'loading', error: null, partial: '' });
  configureAudioSession();
  void requestPersistentStorage();
  const pref = useSettings.getState().voice.engine;
  try {
    if (pref !== 'webspeech' && voskSupported()) {
      try {
        await startVosk(gen);
      } catch (err) {
        if (err instanceof Cancelled) throw err;
        cleanup();
        if (pref === 'vosk' || !webSpeechSupported()) throw err;
        voice().set({
          warnings: [`Vosk nicht verfügbar (${message(err)}) – nutze die Spracherkennung des Browsers.`],
        });
        await startWebSpeech(gen);
      }
    } else {
      await startWebSpeech(gen);
    }
    check(gen);
    voice().set({ status: 'listening', modelProgress: null });
  } catch (err) {
    // während des Startens gestoppt: stopVoice hat schon aufgeräumt
    if (err instanceof Cancelled) return;
    cleanup();
    voice().set({ status: 'off', engine: 'none', error: friendlyError(err), modelProgress: null });
  } finally {
    if (gen === generation) starting = false;
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function friendlyError(err: unknown): string {
  const m = message(err);
  if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError'))
    return 'Mikrofon nicht erlaubt. Erlaube den Zugriff in den Browser-Einstellungen (und nutze HTTPS).';
  if (err instanceof DOMException && err.name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  return m || 'Sprachsteuerung konnte nicht starten.';
}

function cleanup() {
  engine?.stop();
  engine = null;
  pipeline?.stop();
  pipeline = null;
}

export function stopVoice(): void {
  generation++;
  starting = false;
  cleanup();
  paused = false;
  voice().set({ status: 'off', engine: 'none', level: 0, partial: '', gateOpen: false, modelProgress: null });
}

export function setPaused(p: boolean): void {
  paused = p;
  if (engine) voice().set({ status: p ? 'paused' : 'listening' });
  emitFeedback({ type: 'control', action: p ? 'pause' : 'resume' });
}

export function isVoiceRunning(): boolean {
  return engine !== null;
}

let lastCommit = { key: '', at: 0 };

export function handleTranscript(t: Transcript): void {
  const s = voice();
  voice().set({ partial: '', status: s.status === 'hearing' ? 'listening' : s.status });
  const echoMuted = isEchoMuted();
  const armed = voice().armedUntil > Date.now();
  if (!echoMuted) markArmed(t.text);
  const v = useSettings.getState().voice;
  const d = decide(t, {
    mode: v.mode,
    trigger: v.trigger,
    aliases: v.aliases,
    minConfidence: v.minConfidence,
    triggerMinConfidence: v.triggerMinConfidence,
    paused,
    echoMuted,
    armed,
  });
  const push = (accepted: boolean, note?: string) =>
    s.pushResult({
      at: Date.now(),
      text: d.text,
      confidence: t.confidence,
      accepted,
      ...(note ? { note } : {}),
    });

  if (s.testMode && d.kind !== 'reject') {
    push(d.kind === 'accept', d.kind === 'accept' ? `Test: ${d.command.type}` : 'kein Befehl');
    return;
  }
  switch (d.kind) {
    case 'arm':
      push(false, 'Triggerwort – warte auf Zahl');
      return;
    case 'ignore':
      disarm();
      push(false, 'kein Befehl');
      if (d.signal) emitFeedback({ type: 'rejected', reason: 'notUnderstood', heard: t.text });
      return;
    case 'reject':
      push(
        false,
        d.reason === 'echo'
          ? 'eigene Ansage'
          : d.reason === 'paused'
            ? 'pausiert'
            : d.reason === 'lowTriggerConfidence'
              ? 'Triggerwort unsicher'
              : `zu unsicher (${Math.round((t.confidence ?? 0) * 100)} %)`,
      );
      if (d.signal && !s.testMode) emitFeedback({ type: 'rejected', reason: 'notUnderstood', heard: t.text });
      return;
    case 'accept': {
      // Entprellung: gleicher Befehl innerhalb von 1,5 s und alles in 800 ms nach einer Buchung zählt nicht
      const key = JSON.stringify(d.command);
      const now = Date.now();
      if ((key === lastCommit.key && now - lastCommit.at < 1500) || now - lastCommit.at < 800) {
        push(false, 'doppelt');
        return;
      }
      lastCommit = { key, at: now };
      push(true);
      disarm();
      dispatch(d.command);
    }
  }
}

function dispatch(cmd: Command): void {
  if (cmd.type === 'score') submitVisit(cmd.value, { source: 'voice' });
  else undo('voice');
}

// ---- Einstellungen live übernehmen ----
useSettings.subscribe((s, prev) => {
  if (!pipeline && !engine) return;
  if (s.voice.gainDb !== prev.voice.gainDb) pipeline?.setGain(s.voice.gainDb);
  if (s.voice.gateDb !== prev.voice.gateDb) pipeline?.setGate(s.voice.gateDb);
  if (s.voice.trigger !== prev.voice.trigger || s.voice.aliases !== prev.voice.aliases) {
    const e = engine;
    if (e?.setGrammar) void loadVocab().then((vocab) => e.setGrammar!(currentGrammar(vocab)));
  }
  const restart =
    s.voice.noiseSuppression !== prev.voice.noiseSuppression ||
    s.voice.autoGainControl !== prev.voice.autoGainControl ||
    s.voice.engine !== prev.voice.engine;
  if (restart) {
    stopVoice();
    void startVoice();
  }
});

// ---- Echo-Schutz ----
onEchoMute((muted) => pipeline?.setMuted(muted));

// ---- Unterbrechungen: beim Zurückkommen AudioContext/Recognizer fortsetzen ----
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !engine) return;
  if (pipeline && !pipeline.trackLive) {
    // iOS beendet das Mikro im Hintergrund → komplett neu starten
    stopVoice();
    void startVoice();
    return;
  }
  void pipeline?.resume();
  voice().set({ status: paused ? 'paused' : 'listening', error: null });
});

// Safari startet AudioContext manchmal angehalten → beim nächsten Tippen fortsetzen
window.addEventListener('pointerdown', () => void pipeline?.resume(), { passive: true });
