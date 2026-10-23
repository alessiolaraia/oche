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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="row">
      <span className="label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div className="segmented">
        {(Object.keys(options) as T[]).map((o) => (
          <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
            {options[o]}
          </button>
        ))}
      </div>
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
    <label className="row">
      <span className="label">
        {label} <strong>{format(value)}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
