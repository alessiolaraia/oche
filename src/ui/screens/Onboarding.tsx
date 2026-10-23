import { useState } from 'react';
import { useSettings } from '../../store/settings';
import { navigate } from '../router';

const isIos = () =>
  /iP(hone|ad|od)/.test(navigator.platform) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const finish = () => {
    setOnboarded(true);
    navigate('setup');
  };

  return (
    <div className="screen onboarding">
      <header className="screen-head">
        <h1>Einrichten</h1>
        <button className="btn btn-quiet" onClick={finish}>
          Überspringen
        </button>
      </header>
      {step === 0 && (
        <section>
          <p>
            Oche zählt deine Darts per Stimme. Leg das Handy oder den Laptop neben das Board, sag „Wurf
            sechzig“ – die App zieht ab und sagt dir den Rest.
          </p>
          {isIos() && !isStandalone() && (
            <p className="hint">
              Auf dem iPhone: Tippe in Safari auf Teilen und dann auf „Zum Home-Bildschirm“. Als App bleibt
              der Bildschirm an und das Mikro läuft stabiler.
            </p>
          )}
          <button className="btn btn-primary" onClick={() => setStep(1)}>
            Weiter
          </button>
        </section>
      )}
      {step >= 1 && (
        <section>
          <p>Das Mikro richtest du gleich ein.</p>
          <button className="btn btn-primary" onClick={finish}>
            Los geht’s
          </button>
        </section>
      )}
    </div>
  );
}
