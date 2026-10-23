import { useEffect, useState } from 'react';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { startVoice } from '../../voice/control';
import { Calibration } from '../components/Calibration';
import { capitalize } from '../components/controls';
import { navigate } from '../router';

const isIos = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const STEPS = ['Willkommen', 'Mikro', 'Kalibrieren', 'Test'] as const;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const trigger = useSettings((s) => s.voice.trigger);
  const status = useVoice((s) => s.status);
  const error = useVoice((s) => s.error);
  const progress = useVoice((s) => s.modelProgress);
  const results = useVoice((s) => s.results);

  const finish = () => {
    useVoice.getState().set({ testMode: false });
    setOnboarded(true);
    navigate('setup');
  };

  // Im Test-Schritt nur anzeigen, nichts zählen
  useEffect(() => {
    useVoice.getState().set({ testMode: step === 3 });
  }, [step]);

  const micReady = status === 'listening' || status === 'hearing' || status === 'paused';
  const testHeard = results.find((r) => r.accepted && r.note?.startsWith('Test: score'));

  return (
    <div className="screen onboarding">
      <header className="screen-head">
        <h1>Einrichten</h1>
        <button className="btn btn-quiet" onClick={finish}>
          Überspringen
        </button>
      </header>
      <ol className="onboarding-steps" aria-label="Schritte">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} data-done={i < step}>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="onboarding-step">
          <p>
            Oche zählt deine Darts per Stimme. Leg das Gerät neben das Board, sag „{capitalize(trigger)}{' '}
            sechzig“ – die App zieht ab und sagt dir den Rest. Anfassen musst du es nicht.
          </p>
          {isIos() && !isStandalone() && (
            <div className="onboarding-ios">
              <h2>Erst auf den Home-Bildschirm</h2>
              <p>
                Tippe in Safari unten auf Teilen, dann auf „Zum Home-Bildschirm“ und öffne Oche von dort. Als
                App bleibt der Bildschirm an und das Mikro läuft stabiler.
              </p>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setStep(1)}>
            Weiter
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="onboarding-step">
          <p>Oche braucht dein Mikrofon. Die Erkennung läuft auf dem Gerät – nichts wird hochgeladen.</p>
          {status === 'off' && (
            <button className="btn btn-primary onboarding-big" onClick={() => void startVoice()}>
              Mikro erlauben
            </button>
          )}
          {status === 'loading' && <p aria-live="polite">{progress ?? 'Starte Mikro …'}</p>}
          {micReady && <p className="ok">Mikro läuft.</p>}
          {error && <p className="warn">{error}</p>}
          <button className="btn" disabled={!micReady} onClick={() => setStep(2)}>
            Weiter
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="onboarding-step">
          <Calibration />
          <button className="btn" onClick={() => setStep(3)}>
            Weiter
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="onboarding-step">
          <p className="calibration-step">Sag vom Abwurf aus: „{capitalize(trigger)} sechzig“</p>
          {testHeard ? (
            <p className="ok">Verstanden: „{testHeard.text}“</p>
          ) : (
            <p className="hint">Ich höre zu … {results[0] ? `Zuletzt: „${results[0].text}“` : ''}</p>
          )}
          <button className="btn btn-primary" onClick={finish}>
            Los geht’s
          </button>
        </section>
      )}
    </div>
  );
}
