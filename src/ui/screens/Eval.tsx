import { useEffect, useState } from 'react';

/** Nur für den automatischen Eval-Runner: stellt window.__ocheEval bereit. */
export function Eval() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void import('../../eval/harness').then((m) => {
      window.__ocheEval = m.api;
      setReady(true);
    });
  }, []);
  return (
    <div className="screen">
      <p className="hint" data-testid="eval-ready">
        {ready ? 'Eval bereit' : 'Lade …'}
      </p>
    </div>
  );
}
