import { useVoice } from '../../store/voice';
import './level-meter.css';

const MIN_DB = -80;
const pct = (db: number) => `${Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100))}%`;

/** Pegel nach Verstärkung, mit Markierung des Noise Gates. */
export function LevelMeter({ gateDb }: { gateDb: number }) {
  const inputDb = useVoice((s) => s.inputDb);
  const gateOpen = useVoice((s) => s.gateOpen);
  return (
    <div
      className="level"
      role="meter"
      aria-valuemin={MIN_DB}
      aria-valuemax={0}
      aria-valuenow={Math.round(inputDb)}
      aria-label="Mikrofonpegel"
    >
      <div className="level-bar" data-open={gateOpen} style={{ width: pct(inputDb) }} />
      <div className="level-gate" style={{ left: pct(gateDb) }} title="Noise Gate" />
      <span className="level-text">
        {inputDb <= -99
          ? 'Noch kein Signal'
          : `${Math.round(inputDb)} dB${gateOpen ? ', Stimme erkannt' : ''}`}
      </span>
    </div>
  );
}
