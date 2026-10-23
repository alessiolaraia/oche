import type { SpeechEngine, Transcript } from './engine';

// Minimale Typen – die Web Speech API ist nicht in lib.dom enthalten.
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: SRAlternative;
}
interface SREvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: SRResult };
}
interface SRErrorEvent {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRConstructor = new () => SpeechRecognitionLike;

function ctor(): SRConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechSupported(): boolean {
  return ctor() !== null;
}

/** Fallback: Spracherkennung des Browsers (teils Cloud), mit Auto-Restart nach Pausen. */
export class WebSpeechEngine implements SpeechEngine {
  readonly kind = 'webspeech' as const;
  onTranscript: ((t: Transcript) => void) | null = null;
  onPartial: ((text: string) => void) | null = null;
  onError: ((message: string) => void) | null = null;
  private rec: SpeechRecognitionLike | null = null;
  private running = false;
  private restarts = 0;

  async start(): Promise<void> {
    const C = ctor();
    if (!C) throw new Error('Dieser Browser hat keine Spracherkennung.');
    this.running = true;
    const rec = new C();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      this.restarts = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const alts: SRAlternative[] = [];
        for (let k = 0; k < r.length; k++) alts.push(r[k]!);
        if (!r.isFinal) {
          this.onPartial?.(alts[0]?.transcript ?? '');
          continue;
        }
        const [best, ...rest] = alts;
        if (!best) continue;
        this.onTranscript?.({
          text: best.transcript,
          alternatives: rest.map((a) => a.transcript),
          confidence: best.confidence > 0 ? best.confidence : null,
        });
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.running = false;
        this.onError?.('Mikrofon oder Spracherkennung nicht erlaubt.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.onError?.(`Spracherkennung: ${e.error}`);
      }
    };
    rec.onend = () => {
      // Web Speech beendet sich nach Pausen selbst → neu starten, mit wachsender Pause bei Fehlern
      if (!this.running) return;
      const wait = Math.min(5000, 150 * 2 ** this.restarts++);
      setTimeout(() => {
        if (!this.running) return;
        try {
          rec.start();
        } catch {
          /* läuft schon */
        }
      }, wait);
    };
    this.rec = rec;
    rec.start();
  }

  stop(): void {
    this.running = false;
    this.rec?.abort();
    this.rec = null;
  }
}
