// Oche Audio-Worklet: Noise Gate (mit Vorlauf), Pegelmessung, Downsampling auf 16 kHz.
// Bewusst reines JS ohne Build-Schritt, damit es in jedem Browser als Worklet-Modul lädt.
/* global sampleRate, currentFrame, registerProcessor, AudioWorkletProcessor */

const TARGET_RATE = 16000;
const CHUNK = 480; // 30 ms bei 16 kHz – kleine Blöcke, damit Teilergebnisse (Triggerwort) sofort kommen
const LOOKAHEAD_S = 0.15; // Vorlauf: beim Öffnen des Gates wird das zuvor Gehörte nachgereicht („W“urf)
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
    this.wasOpen = false;
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
    // Sauberes Downsampling (Flag dsp2): Tiefpass-FIR (7 kHz, Blackman) + lineare Interpolation
    this.dsp2 = false;
    this.fir = makeLowpass(7000 / sampleRate, 63);
    this.ring = new Float32Array(this.fir.length);
    this.ringPos = 0;
    this.k = 0; // Index des aktuellen Eingangssamples
    this.nextOut = 0; // Position des nächsten 16-kHz-Samples in Eingangssamples
    this.prevF = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (typeof m.gateDb === 'number') this.gateDb = m.gateDb;
      if (typeof m.muted === 'boolean') this.muted = m.muted;
      if (typeof m.dsp2 === 'boolean') this.dsp2 = m.dsp2;
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
    if (open && !this.wasOpen) {
      // Gate geht auf: Vorlauf sofort nachreichen (mit kurzer Einblendung) – ohne feste Verzögerung im Normalbetrieb
      const n = this.delay.length;
      const fade = Math.round(0.01 * sampleRate);
      for (let j = 0; j < n; j++) {
        const x = this.delay[(this.delayPos + j) % n];
        this.emit(j < fade ? (x * j) / fade : x);
      }
      this.gain = 1;
    }
    this.wasOpen = open;
    for (let i = 0; i < ch.length; i++) {
      this.delay[this.delayPos] = ch[i];
      this.delayPos = (this.delayPos + 1) % this.delay.length;
      const target = open ? 1 : 0;
      this.gain += Math.max(-step, Math.min(step, target - this.gain));
      this.emit(ch[i] * this.gain);
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

/** Ein Eingangssample → 16 kHz → Blöcke an den Hauptthread. */
OcheProcessor.prototype.emit = function (y) {
  if (this.dsp2) {
    this.resampleFir(y);
    return;
  }
  // Boxcar-Dezimierung auf 16 kHz
  this.sum += y;
  this.count++;
  this.acc += 1;
  if (this.acc >= this.ratio) {
    this.acc -= this.ratio;
    this.out[this.outPos++] = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    if (this.outPos === CHUNK) this.flushChunk();
  }
};

OcheProcessor.prototype.flushChunk = function () {
  const chunk = this.out;
  this.port.postMessage({ type: 'pcm', data: chunk }, [chunk.buffer]);
  this.out = new Float32Array(CHUNK);
  this.outPos = 0;
};

function makeLowpass(fc, n) {
  const h = new Float32Array(n);
  const m = (n - 1) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - m;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= sum;
  return h;
}

OcheProcessor.prototype.resampleFir = function (y) {
  const n = this.fir.length;
  this.ring[this.ringPos] = y;
  this.ringPos = (this.ringPos + 1) % n;
  let f = 0;
  for (let j = 0, idx = this.ringPos; j < n; j++, idx = (idx + 1) % n) f += this.fir[j] * this.ring[idx];
  while (this.nextOut <= this.k) {
    const frac = this.nextOut - (this.k - 1);
    this.out[this.outPos++] = this.prevF + (f - this.prevF) * frac;
    this.nextOut += this.ratio;
    if (this.outPos === CHUNK) this.flushChunk();
  }
  this.prevF = f;
  this.k++;
};

registerProcessor('oche-processor', OcheProcessor);
