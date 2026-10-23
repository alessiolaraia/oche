import { useVoice } from '../../store/voice';

/** Der Bildschirmrand als Mikrofon-Status – aus der Distanz sichtbar. */
export function Ring() {
  const status = useVoice((s) => s.status);
  const level = useVoice((s) => s.level);
  const style =
    status === 'hearing'
      ? ({ '--ring-opacity': String(0.35 + Math.min(1, level) * 0.65) } as React.CSSProperties)
      : undefined;
  return <div className="ring" data-status={status} style={style} aria-hidden="true" />;
}
