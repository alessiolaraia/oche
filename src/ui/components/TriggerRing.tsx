import { useEffect, useState } from 'react';
import { useVoice } from '../../store/voice';
import './trigger-ring.css';

/**
 * Leuchtender Bildschirmrand, sobald das Triggerwort gehört wurde – aus 2–3 m sichtbar:
 * „Ich höre dich, sag jetzt die Zahl.“ Erlischt nach der Entscheidung oder nach 4 s.
 */
export function TriggerRing() {
  const armedUntil = useVoice((s) => s.armedUntil);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const left = armedUntil - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => setNow(Date.now()), left + 20);
    return () => clearTimeout(t);
  }, [armedUntil]);

  // `now` wird erst nach Ablauf aktualisiert – bis dahin gilt der Rand als an
  const on = armedUntil > now;
  return (
    <div className="trigger-ring" data-on={on} aria-hidden="true">
      {/* Unschärfe auf dem Container, Maske auf dem Kind – sonst entsteht innen eine harte Kante */}
      <div className="ring-blur ring-blur-haze">
        <div className="ring-layer ring-layer-haze" />
      </div>
      <div className="ring-blur ring-blur-glow">
        <div className="ring-layer ring-layer-glow" />
      </div>
      <div className="ring-layer ring-layer-line" />
    </div>
  );
}
