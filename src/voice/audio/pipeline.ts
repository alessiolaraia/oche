// getUserMedia → Gain → Compressor → AudioWorklet (Gate, Pegel, 16 kHz) → onChunk
export interface PipelineOptions {
  gainDb: number;
  gateDb: number;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface Level {
  db: number;
  peakDb: number;
  gateOpen: boolean;
}

export const dbToGain = (db: number) => 10 ** (db / 20);

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
    node.port.onmessage = (
      e: MessageEvent<{ type: 'pcm'; data: Float32Array } | ({ type: 'level' } & Level)>,
    ) => {
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
      },
      video: false,
    });
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/oche-processor.js`);
    const source = ctx.createMediaStreamSource(stream);
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
    // Worklet muss am Graph hängen, damit er läuft – stumm an den Ausgang
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(gainNode).connect(comp).connect(node).connect(sink).connect(ctx.destination);
    const p = new AudioPipeline(ctx, stream, gainNode, node);
    p.setGate(opts.gateDb);
    if (ctx.state !== 'running') await ctx.resume();
    return p;
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
