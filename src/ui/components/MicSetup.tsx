import { useEffect } from 'react';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { presetCalibration, type Environment } from '../../voice/audio/calibrationMath';
import { startVoice } from '../../voice/control';
import { capitalize, Choice, Range } from './controls';
import { LevelMeter } from './LevelMeter';
import { VoiceLog } from './VoiceLog';

const ENV_LABEL: Record<Environment, string> = {
  veryQuiet: 'Sehr leise',
  quiet: 'Leise',
  medium: 'Mittel',
  loud: 'Laut',
  veryLoud: 'Sehr laut',
};

const ENV_HINT: Record<Environment, string> = {
  veryQuiet: 'Allein, kein Fernseher, keine Musik.',
  quiet: 'Zu zweit, ruhige Unterhaltung.',
  medium: 'Mehrere Leute, leise Musik.',
  loud: 'Vereinsheim, Musik, Gespräche am Tisch.',
  veryLoud: 'Kneipe am Abend, Turnier.',
};

const meters = (m: number) => `${m.toFixed(1).replace('.', ',').replace(',0', '')} m`;

/**
 * Einfache Kalibrierung: Entfernung und Umgebungslautstärke wählen – Verstärkung, Noise Gate und
 * Erkennungs-Strenge werden daraus berechnet. Darunter ein Test mit Pegel und erkanntem Text.
 */
export function MicSetup({ showTest = true }: { showTest?: boolean }) {
  const v = useSettings((s) => s.voice);
  const update = useSettings((s) => s.update);
  const status = useVoice((s) => s.status);

  // Testmodus gilt nur, solange dieser Bereich offen ist – im Spiel soll wieder gezählt werden
  useEffect(() => () => useVoice.getState().set({ testMode: false }), []);

  const apply = (distanceM: number, environment: Environment) =>
    update('voice', { distanceM, environment, ...presetCalibration(distanceM, environment) });

  return (
    <>
      <Range
        label="Abstand vom Handy zum Abwurf"
        min={0.5}
        max={5}
        step={0.5}
        value={v.distanceM}
        format={meters}
        onChange={(d) => apply(d, v.environment)}
      />
      <Choice<Environment>
        full
        label="Wie laut ist es im Raum?"
        hint={ENV_HINT[v.environment]}
        value={v.environment}
        options={ENV_LABEL}
        onChange={(e) => apply(v.distanceM, e)}
      />
      {showTest && (
        <div className="stack mic-test">
          <span className="label">
            Testen
            <small>
              Sag vom Abwurf „{capitalize(v.trigger)} sechzig“. Der Balken soll beim Sprechen die Markierung
              deutlich überschreiten – im Testmodus wird nichts gezählt.
            </small>
          </span>
          {status === 'off' ? (
            <button
              className="btn"
              onClick={() => {
                useVoice.getState().set({ testMode: true });
                void startVoice();
              }}
            >
              Mikro testen
            </button>
          ) : (
            <>
              <LevelMeter gateDb={v.gateDb} />
              <VoiceLog limit={3} />
            </>
          )}
        </div>
      )}
    </>
  );
}
