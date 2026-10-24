import { useVoice } from '../../store/voice';
import './mic-aura.css';

/**
 * Die eine Aura des Spiel-Screens – zugleich Mikro-Status, aus der Distanz sichtbar:
 * atmet = hört zu, wächst mit dem Pegel = Sprache erkannt, grau = pausiert/aus.
 */
export function MicAura() {
  const status = useVoice((s) => s.status);
  const level = useVoice((s) => s.level);
  const scale = status === 'hearing' ? 1 + Math.min(1, level) * 0.45 : 1;
  return (
    <div
      className="mic-aura sg-aura"
      data-status={status}
      style={{ '--aura-scale': scale } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}

const STATUS_TEXT = {
  off: 'Mikro aus',
  loading: 'Lädt …',
  listening: 'Hört zu',
  hearing: 'Hört zu',
  paused: 'Pausiert',
} as const;

/** Kleiner Status-Chip (für Nahsicht und Screenreader). */
export function MicChip() {
  const status = useVoice((s) => s.status);
  return (
    <span className="chip mic-chip" data-status={status} role="status">
      <span className="mic-dot" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}
