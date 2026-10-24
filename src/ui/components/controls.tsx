import type { ReactNode } from 'react';

export function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="row">
      <span className="label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  full = false,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
  /** Segment-Schalter über die ganze Breite unter dem Label. */
  full?: boolean;
}) {
  const seg = (
    <div className={`segmented${full ? ' segmented-full' : ''}`} role="group" aria-label={label}>
      {(Object.keys(options) as T[]).map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
          {options[o]}
        </button>
      ))}
    </div>
  );
  if (full)
    return (
      <div className="stack choice-full">
        <span className="label">
          {label}
          {hint && <small>{hint}</small>}
        </span>
        {seg}
      </div>
    );
  return (
    <div className="row">
      <span className="label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {seg}
    </div>
  );
}

export function Range({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="stack range-row">
      <span className="range-head">
        <span className="label">
          {label}
          {hint && <small>{hint}</small>}
        </span>
        <strong className="range-value">{format(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
