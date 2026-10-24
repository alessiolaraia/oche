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
  return <div className="trigger-ring" data-on={on} aria-hidden="true" />;
}
