// Sprachsteuerung: startet Engine + Audio-Pipeline, wertet Transkripte aus und ruft den Controller auf.
import {
  answerQuestion,
  correctLastVisit,
  requestRemaining,
  rejectRecent,
  restartLeg,
  submitDarts,
  submitVisit,
  undo,
} from '../app/controller';
import { emitFeedback } from '../app/feedback';
import { isFinishable } from '../engine/checkouts';
import { configureAudioSession } from '../platform/audioSession';
import { requestPersistentStorage } from '../platform/storage';
import { useMatch } from '../store/match';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { useVoice } from '../store/voice';
import { AudioPipeline, type Level } from './audio/pipeline';
import { buildGrammar, parseCommand, type Command } from './commands';
import { isEchoMuted, onEchoMute } from './echo';
import type { SpeechEngine, Transcript } from './engine';
import { tokenize, parseNumberAt } from './numbers.de';
import { loadVocab } from './vocab';
import { VoskEngine } from './voskEngine';
import { WebSpeechEngine, webSpeechSupported } from './webSpeechEngine';

let engine: SpeechEngine | null = null;
let pipeline: AudioPipeline | null = null;
let starting = false;
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
  const grammar = buildGrammar({ trigger: v.trigger, singleDarts: v.singleDarts, vocab });
  const triggerOk = vocab.has(v.trigger.toLowerCase());
  const warnings: string[] = [];
  if (!triggerOk)
    warnings.push(`Das Triggerwort „${v.trigger}“ kennt das Sprachmodell nicht. Wähle ein anderes.`);
  voice().set({ warnings });
  return grammar;
}

async function startVosk(): Promise<void> {
  pipeline = await startPipeline();
  voice().set({ modelProgress: 'Sprachmodell wird geladen (45 MB, nur beim ersten Mal) …' });
  const vocab = await loadVocab();
  const e = new VoskEngine(currentGrammar(vocab));
  wire(e);
  await e.start();
  engine = e;
  pipeline.onChunk = (pcm) => e.feed(pcm);
  voice().set({ modelProgress: null, engine: 'vosk' });
}

async function startWebSpeech(): Promise<void> {
  const e = new WebSpeechEngine();
  wire(e);
  await e.start();
  engine = e;
  voice().set({ engine: 'webspeech', warnings: [] });
}

const ARMED_MS = 4000;

/** Rand leuchten lassen, sobald das Triggerwort (Direkt-Modus: irgendeine Sprache) zu hören ist. */
function markArmed(text: string): void {
  const v = useSettings.getState().voice;
  const t = tokenize(text);
  if (t.length === 0) return;
  const heardTrigger = v.mode === 'direct' || t[0] === v.trigger.toLowerCase();
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
  paused = false;
  voice().set({ status: 'loading', error: null, partial: '' });
  configureAudioSession();
  void requestPersistentStorage();
  const pref = useSettings.getState().voice.engine;
  try {
    if (pref !== 'webspeech' && voskSupported()) {
      try {
        await startVosk();
      } catch (err) {
        cleanup();
        if (pref === 'vosk' || !webSpeechSupported()) throw err;
        voice().set({
          warnings: [`Vosk nicht verfügbar (${message(err)}) – nutze die Spracherkennung des Browsers.`],
        });
        await startWebSpeech();
      }
    } else {
      await startWebSpeech();
    }
    voice().set({ status: 'listening', modelProgress: null });
  } catch (err) {
    cleanup();
    voice().set({ status: 'off', engine: 'none', error: friendlyError(err), modelProgress: null });
  } finally {
    starting = false;
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
  cleanup();
  paused = false;
  voice().set({ status: 'off', engine: 'none', level: 0, partial: '', gateOpen: false });
}

export function setPaused(p: boolean): void {
  paused = p;
  if (engine) voice().set({ status: p ? 'paused' : 'listening' });
  emitFeedback({ type: 'control', action: p ? 'pause' : 'resume' });
}

export function isVoiceRunning(): boolean {
  return engine !== null;
}

/** Signalisieren nur, wenn es nach einem Befehl klang (Triggerwort bzw. Zahl im Direkt-Modus). */
function soundedLikeCommand(text: string): boolean {
  const v = useSettings.getState().voice;
  const t = tokenize(text);
  if (t.length === 0) return false;
  if (t[0] === v.trigger.toLowerCase()) return true;
  return v.mode === 'direct' && t.some((_, i) => parseNumberAt(t, i) !== null);
}

export function handleTranscript(t: Transcript): void {
  const s = voice();
  voice().set({ partial: '', status: s.status === 'hearing' ? 'listening' : s.status });
  if (isEchoMuted()) {
    s.pushResult({
      at: Date.now(),
      text: t.text,
      confidence: t.confidence,
      accepted: false,
      note: 'eigene Ansage',
    });
    return;
  }
  markArmed(t.text);
  const v = useSettings.getState().voice;
  const opts = {
    mode: v.mode,
    trigger: v.trigger,
    singleDarts: v.singleDarts,
    awaitingAnswer: useSession.getState().question !== null,
  };
  let cmd: Command | null = null;
  let used = t.text;
  for (const candidate of [t.text, ...t.alternatives]) {
    cmd = parseCommand(candidate, opts);
    if (cmd) {
      used = candidate;
      break;
    }
  }
  const push = (accepted: boolean, note?: string) =>
    s.pushResult({
      at: Date.now(),
      text: used,
      confidence: t.confidence,
      accepted,
      ...(note ? { note } : {}),
    });

  if (s.testMode) {
    push(cmd !== null, cmd ? `Test: ${cmd.type}` : 'kein Befehl');
    return;
  }
  if (!cmd) {
    disarm();
    push(false, 'kein Befehl');
    if (soundedLikeCommand(t.text))
      emitFeedback({ type: 'rejected', reason: 'notUnderstood', heard: t.text });
    return;
  }
  if (t.confidence !== null && t.confidence < v.minConfidence) {
    push(false, `zu unsicher (${Math.round(t.confidence * 100)} %)`);
    emitFeedback({ type: 'rejected', reason: 'notUnderstood', heard: t.text });
    return;
  }
  if (paused && cmd.type !== 'resume' && cmd.type !== 'micOff') {
    push(false, 'pausiert');
    return;
  }
  push(true);
  disarm();
  dispatch(cmd);
}

function dispatch(cmd: Command): void {
  switch (cmd.type) {
    case 'score':
      submitVisit(cmd.value, { source: 'voice' });
      break;
    case 'darts':
      submitDarts(cmd.darts, 'voice');
      break;
    case 'bust':
      submitVisit(0, { bust: true, source: 'voice' });
      break;
    case 'undo':
      undo('voice');
      break;
    case 'reject':
      rejectRecent();
      break;
    case 'correct':
      correctLastVisit(cmd.value, 'voice');
      break;
    case 'remaining':
      requestRemaining();
      break;
    case 'answer':
      answerQuestion(cmd.value);
      break;
    case 'checkoutDarts':
      checkoutWithDarts(cmd.value);
      break;
    case 'newLeg':
      restartLeg();
      break;
    case 'pause':
      setPaused(true);
      break;
    case 'resume':
      setPaused(false);
      break;
    case 'micOff':
      emitFeedback({ type: 'control', action: 'micOff' });
      stopVoice();
      break;
  }
}

/**
 * „Check mit zwei“: beantwortet eine offene Nachfrage; sonst ist es der Checkout selbst
 * (Rest des Spielers am Zug mit n Darts).
 */
function checkoutWithDarts(n: number): void {
  if (useSession.getState().question === 'checkoutDarts') {
    answerQuestion(n);
    return;
  }
  const { state } = useMatch.getState();
  if (!state || state.winner !== null) return;
  const p = state.players[state.current]!;
  if (p.isIn && isFinishable(p.remaining, state.config.outMode, n)) {
    submitVisit(p.remaining, { dartsUsed: n, source: 'voice' });
  } else {
    emitFeedback({ type: 'rejected', reason: 'notFinishable' });
  }
}

// ---- Einstellungen live übernehmen ----
useSettings.subscribe((s, prev) => {
  if (!pipeline && !engine) return;
  if (s.voice.gainDb !== prev.voice.gainDb) pipeline?.setGain(s.voice.gainDb);
  if (s.voice.gateDb !== prev.voice.gateDb) pipeline?.setGate(s.voice.gateDb);
  if (s.voice.trigger !== prev.voice.trigger || s.voice.singleDarts !== prev.voice.singleDarts) {
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
