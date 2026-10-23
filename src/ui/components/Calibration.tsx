import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import {
  collectLevels,
  computeCalibration,
  ensurePipeline,
  type CalibrationResult,
} from '../../voice/audio/calibrate';
import { capitalize } from './controls';
import { LevelMeter } from './LevelMeter';

type Phase = 'idle' | 'room' | 'speech' | 'done' | 'error';

const ROOM_MS = 10_000;
const SPEECH_MS = 6_000;

/** Auto-Kalibrieren: 10 s Raumgeräusch messen, dann einen Testsatz aus Abwurfdistanz. */
export function Calibration({ onDone }: { onDone?: (r: CalibrationResult) => void }) {
  const voice = useSettings((s) => s.voice);
  const update = useSettings((s) => s.update);
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const run = async () => {
    setError(null);
    setResult(null);
    let release = () => {};
    try {
      release = await ensurePipeline();
      useVoice.getState().set({ testMode: true });
      setPhase('room');
      const room = await collectLevels(ROOM_MS, (ms) => setLeft(Math.ceil(ms / 1000)));
      if (cancelled.current) return;
      setPhase('speech');
      const speech = await collectLevels(SPEECH_MS, (ms) => setLeft(Math.ceil(ms / 1000)));
      if (cancelled.current) return;
      const r = computeCalibration(room, speech, useSettings.getState().voice.gainDb);
      update('voice', { gainDb: r.gainDb, gateDb: r.gateDb });
      setResult(r);
      setPhase('done');
      onDone?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    } finally {
      useVoice.getState().set({ testMode: false });
      release();
    }
  };

  return (
    <div className="calibration">
      {phase === 'idle' && (
        <>
          <p className="hint">
            Stell dich an den Abwurf. Erst 10 Sekunden still sein, dann laut „{capitalize(voice.trigger)}{' '}
            sechzig“ sagen.
          </p>
          <button className="btn btn-primary" onClick={() => void run()}>
            Automatisch kalibrieren
          </button>
        </>
      )}
      {phase === 'room' && (
        <p className="calibration-step" aria-live="polite">
          Ruhe bitte – ich messe den Raum. Noch {left} s
        </p>
      )}
      {phase === 'speech' && (
        <p className="calibration-step calibration-speak" aria-live="polite">
          Jetzt sagen: „{capitalize(voice.trigger)} sechzig“ ({left} s)
        </p>
      )}
      {(phase === 'room' || phase === 'speech') && <LevelMeter gateDb={voice.gateDb} />}
      {phase === 'done' && result && (
        <div aria-live="polite">
          <p className="ok">
            Fertig: Verstärkung {result.gainDb} dB, Gate {result.gateDb} dB (Stimme{' '}
            {Math.round(result.marginDb)} dB über dem Raum).
          </p>
          {result.warning && <p className="warn">{result.warning}</p>}
          <button className="btn" onClick={() => setPhase('idle')}>
            Nochmal
          </button>
        </div>
      )}
      {phase === 'error' && (
        <p className="warn">
          Kalibrierung fehlgeschlagen: {error}{' '}
          <button className="btn" onClick={() => setPhase('idle')}>
            Nochmal
          </button>
        </p>
      )}
    </div>
  );
}
