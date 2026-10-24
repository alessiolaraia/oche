import { useState } from 'react';
import { dartLabel, dartValue, BULL } from '../../engine/checkouts';
import type { Dart, Multiplier } from '../../engine/types';
import './pads.css';

const MULT_LABEL: Record<Multiplier, string> = { 1: 'Single', 2: 'Doppel', 3: 'Triple' };

export function BoardPad({ onSubmit }: { onSubmit: (darts: Dart[]) => void }) {
  const [mult, setMult] = useState<Multiplier>(1);
  const [darts, setDarts] = useState<Dart[]>([]);

  const add = (d: Dart) => {
    const next = [...darts, d];
    setMult(1);
    if (next.length === 3) {
      onSubmit(next);
      setDarts([]);
    } else setDarts(next);
  };

  return (
    <div className="pad">
      <div className="pad-darts" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <span key={i} className="pad-dart">
            {darts[i] ? dartLabel(darts[i]!) : '–'}
          </span>
        ))}
        <span className="pad-dart-sum">{darts.reduce((s, d) => s + dartValue(d), 0)}</span>
      </div>
      <div className="segmented segmented-full pad-mult" role="group" aria-label="Multiplikator">
        {([1, 2, 3] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mult === m} onClick={() => setMult(m)}>
            {MULT_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="pad-board">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="pad-key"
            onClick={() => add({ segment: n, multiplier: mult })}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="pad-key"
          onClick={() => add({ segment: BULL, multiplier: mult === 1 ? 1 : 2 })}
        >
          {mult === 1 ? '25' : 'Bull'}
        </button>
        <button type="button" className="pad-key" onClick={() => add({ segment: 0, multiplier: 1 })}>
          Daneben
        </button>
        <button type="button" className="pad-key" onClick={() => setDarts((d) => d.slice(0, -1))}>
          ⌫
        </button>
        <button
          type="button"
          className="pad-key pad-key-ok"
          disabled={darts.length === 0}
          onClick={() => {
            onSubmit(darts);
            setDarts([]);
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
