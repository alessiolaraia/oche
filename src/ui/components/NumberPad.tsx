import { useState } from 'react';
import './pads.css';

const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const;

export function NumberPad({ onSubmit, onBust }: { onSubmit: (n: number) => void; onBust: () => void }) {
  const [value, setValue] = useState('');

  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') setValue((v) => v.slice(0, -1));
    else if (k === 'ok') {
      if (value !== '') onSubmit(Number(value));
      setValue('');
    } else setValue((v) => (v.length >= 3 ? v : v === '0' ? k : v + k));
  };

  return (
    <div className="pad">
      <div className="pad-quick" role="group" aria-label="Schnelltasten">
        {QUICK.map((q) => (
          <button key={q} type="button" className="pad-key pad-key-quick" onClick={() => onSubmit(q)}>
            {q}
          </button>
        ))}
        <button type="button" className="pad-key pad-key-bust" onClick={onBust}>
          Bust
        </button>
      </div>
      <output className="pad-display" aria-live="polite" data-testid="pad-display">
        {value || ' '}
      </output>
      <div className="pad-grid">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`pad-key${k === 'ok' ? ' pad-key-ok' : ''}`}
            onClick={() => press(k)}
            aria-label={k === 'del' ? 'Löschen' : k === 'ok' ? 'Eintragen' : k}
          >
            {k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
