import { useEffect, useState } from 'react';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { presetCalibration } from '../../voice/audio/calibrationMath';
import { startVoice } from '../../voice/control';
import { capitalize } from '../components/controls';
import { LevelMeter } from '../components/LevelMeter';
import { MicSetup } from '../components/MicSetup';
import { navigate } from '../router';

const isIos = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const STEPS = ['Willkommen', 'Mikro', 'Abstand', 'Test'] as const;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const settings = useSettings();
  const status = useVoice((s) => s.status);
  const error = useVoice((s) => s.error);
  const progress = useVoice((s) => s.modelProgress);
  const results = useVoice((s) => s.results);
  const trigger = settings.voice.trigger;

  const finish = () => {
    useVoice.getState().set({ testMode: false });
    settings.setOnboarded(true);
    navigate('setup');
  };

  // Im Test-Schritt nur anzeigen, nichts zählen
  useEffect(() => {
    useVoice.getState().set({ testMode: step === 3 });
  }, [step]);

  // Startwerte aus der Voreinstellung (2,5 m, mittel), falls noch nie kalibriert
  useEffect(() => {
    const v = useSettings.getState().voice;
    useSettings.getState().update('voice', presetCalibration(v.distanceM, v.environment));
  }, []);

  const micReady = status === 'listening' || status === 'hearing' || status === 'paused';
  const heard = results.find((r) => r.accepted && r.note?.startsWith('Test: score'));

  return (
    <div className="screen onboarding">
      <div className="sg-aura onboarding-aura" aria-hidden="true" />
      <header className="screen-head">
        <span className="onboarding-steps" aria-label={`Schritt ${step + 1} von ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className="onboarding-dot" data-active={i === step} data-done={i < step} />
          ))}
        </span>
        <button className="btn btn-quiet" onClick={finish}>
          Überspringen
        </button>
      </header>

      {step === 0 && (
        <section className="onboarding-step">
          <h1 className="sg-hero">
            Sag einfach,
            <br />
            was du geworfen hast.
          </h1>
          <p className="sg-body">
            Leg das Handy neben das Board und sag „{capitalize(trigger)} sechzig“. Oche zieht ab und sagt dir
            den Rest – anfassen musst du nichts.
          </p>
          {isIos() && !isStandalone() && (
            <div className="card card-pad">
              <h2 className="sg-head">Erst auf den Home-Bildschirm</h2>
              <p className="hint">
                Tippe in Safari auf Teilen und dann auf „Zum Home-Bildschirm“. Als App bleibt der Bildschirm
                an und das Mikro läuft stabiler.
              </p>
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>
            Los geht’s
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="onboarding-step">
          <h1 className="sg-title">Mikrofon erlauben</h1>
          <p className="sg-body">Die Erkennung läuft auf deinem Gerät. Nichts wird hochgeladen.</p>
          {status === 'off' && (
            <button className="btn btn-primary btn-block" onClick={() => void startVoice()}>
              Mikro erlauben
            </button>
          )}
          {status === 'loading' && <p className="hint">{progress ?? 'Starte Mikro …'}</p>}
          {micReady && <p className="ok">Mikro läuft.</p>}
          {error && <p className="warn">{error}</p>}
          <button className="btn btn-block" disabled={!micReady} onClick={() => setStep(2)}>
            Weiter
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="onboarding-step">
          <h1 className="sg-title">Wo steht das Handy?</h1>
          <div className="card">
            <MicSetup showTest={false} />
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setStep(3)}>
            Weiter
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="onboarding-step">
          <h1 className="sg-title">Probier es aus</h1>
          <p className="sg-body">Sag vom Abwurf aus: „{capitalize(trigger)} sechzig“.</p>
          <LevelMeter gateDb={settings.voice.gateDb} />
          {heard ? (
            <p className="ok">Verstanden: „{heard.text}“</p>
          ) : (
            <p className="hint">Ich höre zu … {results[0] ? `Zuletzt: „${results[0].text}“` : ''}</p>
          )}
          <p className="hint">
            Klappt es nicht? Geh zurück und stell eine größere Entfernung oder „lauter“ ein.
          </p>
          <div className="onboarding-actions">
            <button className="btn" onClick={() => setStep(2)}>
              Zurück
            </button>
            <button className="btn btn-primary" onClick={finish}>
              Fertig
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
