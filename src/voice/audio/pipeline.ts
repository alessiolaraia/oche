// getUserMedia → Gain → Compressor → AudioWorklet (Gate, Pegel, 16 kHz) → onChunk
export interface PipelineOptions {
  gainDb: number;
  gateDb: number;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** S2 neu (Flag): Hochpass 120 Hz, Limiter, Tiefpass-Resampler. */
  dsp2?: boolean;
  /** S1: Stimmisolierung des Systems, wo unterstützt (v. a. Apple). */
  voiceIsolation?: boolean;
  /** S1: gewähltes Mikrofon. */
  deviceId?: string;
}

export interface Level {
  db: number;
  peakDb: number;
  gateOpen: boolean;
}

export const dbToGain = (db: number) => 10 ** (db / 20);

const workletUrl = () => `${import.meta.env.BASE_URL}worklets/oche-processor.js`;

type WorkletMessage = { type: 'pcm'; data: Float32Array } | ({ type: 'level' } & Level);

/**
 * Die eigentliche Kette ab der Quelle: Gain → Kompressor → Worklet (Gate, Pegel, 16 kHz).
 * Mikrofon und Eval-Dateiquelle benutzen exakt dieselbe Kette.
 */
export function buildChain(
  ctx: BaseAudioContext,
  source: AudioNode,
  opts: Pick<PipelineOptions, 'gainDb' | 'gateDb' | 'dsp2'>,
): { gainNode: GainNode; node: AudioWorkletNode } {
  let input: AudioNode = source;
  if (opts.dsp2) {
    // Hochpass: Brummen, Trittschall und der tiefe Anteil von Einschlägen raus – die Stimme bleibt
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;
    hp.Q.value = Math.SQRT1_2;
    input = source.connect(hp);
  }
  const gainNode = ctx.createGain();
  gainNode.gain.value = dbToGain(opts.gainDb);
  // Kompressor fängt laute Treffer und Jubel ab, damit nichts übersteuert
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const node = new AudioWorkletNode(ctx, 'oche-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  node.port.postMessage({ gateDb: opts.gateDb, dsp2: !!opts.dsp2 });
  // Worklet muss am Graph hängen, damit er läuft – stumm an den Ausgang
  const sink = ctx.createGain();
  sink.gain.value = 0;
  let chain: AudioNode = input.connect(gainNode).connect(comp);
  if (opts.dsp2) {
    // Limiter hinter dem Kompressor: nie Clipping, auch bei harten Einschlägen
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.1;
    chain = chain.connect(lim);
  }
  chain.connect(node).connect(sink).connect(ctx.destination);
  return { gainNode, node };
}

/**
 * Datei statt Mikrofon (Eval): spielt einen Puffer durch die Kette.
 * `realtime` = echte Wiedergabegeschwindigkeit (für Latenzmessung), sonst so schnell wie möglich.
 */
export async function processBuffer(
  buffer: AudioBuffer,
  opts: Pick<PipelineOptions, 'gainDb' | 'gateDb' | 'dsp2'>,
  handlers: { onChunk: (pcm: Float32Array) => void; onLevel?: (l: Level) => void; realtime?: boolean },
): Promise<{ startedAt: number }> {
  const rate = 48000;
  const ctx = handlers.realtime
    ? new AudioContext({ sampleRate: rate })
    : new OfflineAudioContext(1, Math.ceil(buffer.duration * rate) + rate, rate);
  await ctx.audioWorklet.addModule(workletUrl());
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const { node } = buildChain(ctx, src, opts);
  node.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
    const m = e.data;
    if (m.type === 'pcm') handlers.onChunk(m.data);
    else handlers.onLevel?.(m);
  };
  src.start();
  const startedAt = performance.now();
  if (ctx instanceof OfflineAudioContext) {
    await ctx.startRendering();
  } else {
    if (ctx.state !== 'running') await ctx.resume();
    await new Promise<void>((resolve) => (src.onended = () => resolve()));
    await new Promise((r) => setTimeout(r, 200));
    void ctx.close();
  }
  return { startedAt };
}

export class AudioPipeline {
  onChunk: ((pcm: Float32Array) => void) | null = null;
  onLevel: ((l: Level) => void) | null = null;
  /** Spur beendet/stummgeschaltet (Anruf, anderes App-Audio) bzw. wieder da. */
  onInterrupt: ((interrupted: boolean) => void) | null = null;

  readonly ctx: AudioContext;
  private stream: MediaStream;
  private gainNode: GainNode;
  private node: AudioWorkletNode;

  private constructor(ctx: AudioContext, stream: MediaStream, gainNode: GainNode, node: AudioWorkletNode) {
    this.ctx = ctx;
    this.stream = stream;
    this.gainNode = gainNode;
    this.node = node;
    node.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
      const m = e.data;
      if (m.type === 'pcm') this.onChunk?.(m.data);
      else this.onLevel?.(m);
    };
    for (const track of stream.getAudioTracks()) {
      track.addEventListener('mute', () => this.onInterrupt?.(true));
      track.addEventListener('unmute', () => this.onInterrupt?.(false));
      track.addEventListener('ended', () => this.onInterrupt?.(true));
    }
  }

  static async create(opts: PipelineOptions): Promise<AudioPipeline> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: opts.noiseSuppression,
        autoGainControl: opts.autoGainControl,
        channelCount: 1,
        ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
        // nicht in allen Typdefinitionen – Browser ohne Unterstützung ignorieren es
        ...(opts.voiceIsolation ? ({ voiceIsolation: true } as MediaTrackConstraints) : {}),
      },
      video: false,
    });
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(workletUrl());
    const source = ctx.createMediaStreamSource(stream);
    const { gainNode, node } = buildChain(ctx, source, opts);
    const p = new AudioPipeline(ctx, stream, gainNode, node);
    if (ctx.state !== 'running') await ctx.resume();
    return p;
  }

  /** Was der Browser tatsächlich eingestellt hat (Constraints werden teils still ignoriert). */
  get activeSettings(): Record<string, unknown> {
    const t = this.stream.getAudioTracks()[0];
    return t ? { ...t.getSettings(), label: t.label } : {};
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get trackLive(): boolean {
    return this.stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted);
  }

  setGain(db: number): void {
    this.gainNode.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.05);
  }

  setGate(db: number): void {
    this.node.port.postMessage({ gateDb: db });
  }

  /** Stummschalten (z. B. während die App spricht) – liefert dann Stille statt Signal. */
  setMuted(muted: boolean): void {
    this.node.port.postMessage({ muted });
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  stop(): void {
    for (const t of this.stream.getTracks()) t.stop();
    this.node.port.onmessage = null;
    void this.ctx.close();
  }
}
