import './big-number.css';

/** Riesige Zahl mit Ziffern in Zellen fester Breite – springt nicht, wenn sich Ziffern ändern. */
export function BigNumber({ value, label }: { value: number; label: string }) {
  const digits = String(value).split('');
  return (
    <div className="big-number" style={{ '--digits': Math.max(2, digits.length) } as React.CSSProperties}>
      <span className="sr-only">{label}</span>
      <span className="big-number-digits" aria-hidden="true" data-testid="remaining">
        {digits.map((d, i) => (
          <span key={i} className="big-number-cell">
            {d}
          </span>
        ))}
      </span>
    </div>
  );
}
