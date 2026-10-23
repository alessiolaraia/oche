// Oche Audio-Worklet: Noise Gate (mit Vorlauf), Pegelmessung, Downsampling auf 16 kHz.
// Bewusst reines JS ohne Build-Schritt, damit es in jedem Browser als Worklet-Modul lädt.
/* global sampleRate, currentFrame, registerProcessor, AudioWorkletProcessor */

const TARGET_RATE = 16000;
const CHUNK = 1600; // 100 ms bei 16 kHz
const LOOKAHEAD_S = 0.12; // Gate öffnet rückwirkend, damit der Wortanfang („W“urf) nicht fehlt
const HOLD_S = 0.4;
const LEVEL_EVERY_S = 0.05;

class OcheProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.gateDb = -55;
    this.muted = false;
    this.env = 0;
    this.holdUntil = 0;
    this.gain = 0; // 0..1, weiche Rampe
    this.delay = new Float32Array(Math.ceil(sampleRate * LOOKAHEAD_S));
    this.delayPos = 0;
    this.ratio = sampleRate / TARGET_RATE;
    this.acc = 0;
    this.sum = 0;
    this.count = 0;
    this.out = new Float32Array(CHUNK);
    this.outPos = 0;
    this.peak = 0;
    this.levelSum = 0;
    this.levelCount = 0;
    this.nextLevelAt = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (typeof m.gateDb === 'number') this.gateDb = m.gateDb;
      if (typeof m.muted === 'boolean') this.muted = m.muted;
    };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    // Hüllkurve (RMS-artig) über den Block
    let blockSq = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      blockSq += x * x;
      const a = Math.abs(x);
      if (a > this.peak) this.peak = a;
    }
    const blockRms = Math.sqrt(blockSq / ch.length);
    this.env = blockRms > this.env ? blockRms : this.env * 0.97 + blockRms * 0.03;
    const envDb = 20 * Math.log10(this.env + 1e-9);
    const t = currentFrame / sampleRate;
    if (envDb > this.gateDb) this.holdUntil = t + HOLD_S;
    const open = t < this.holdUntil && !this.muted;

    this.levelSum += blockSq;
    this.levelCount += ch.length;

    const step = 1 / (0.01 * sampleRate); // 10-ms-Rampe
    for (let i = 0; i < ch.length; i++) {
      // Verzögerungsleitung
      const delayed = this.delay[this.delayPos];
      this.delay[this.delayPos] = ch[i];
      this.delayPos = (this.delayPos + 1) % this.delay.length;

      const target = open ? 1 : 0;
      this.gain += Math.max(-step, Math.min(step, target - this.gain));
      const y = delayed * this.gain;

      // Boxcar-Dezimierung auf 16 kHz
      this.sum += y;
      this.count++;
      this.acc += 1;
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio;
        this.out[this.outPos++] = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (this.outPos === CHUNK) {
          const chunk = this.out;
          this.port.postMessage({ type: 'pcm', data: chunk }, [chunk.buffer]);
          this.out = new Float32Array(CHUNK);
          this.outPos = 0;
        }
      }
    }

    if (t >= this.nextLevelAt) {
      this.nextLevelAt = t + LEVEL_EVERY_S;
      const rms = Math.sqrt(this.levelSum / Math.max(1, this.levelCount));
      this.port.postMessage({
        type: 'level',
        db: 20 * Math.log10(rms + 1e-9),
        peakDb: 20 * Math.log10(this.peak + 1e-9),
        gateOpen: open,
      });
      this.levelSum = 0;
      this.levelCount = 0;
      this.peak = 0;
    }
    return true;
  }
}

registerProcessor('oche-processor', OcheProcessor);
