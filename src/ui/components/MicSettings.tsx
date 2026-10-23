import { useEffect, useState } from 'react';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { startVoice } from '../../voice/control';
import { TRIGGER_SUGGESTIONS } from '../../voice/triggers';
import { loadVocab } from '../../voice/vocab';
import { capitalize, Range, Toggle } from './controls';
import { Calibration } from './Calibration';
import { LevelMeter } from './LevelMeter';
import { VoiceLog } from './VoiceLog';

/** Triggerwort, Verstärkung, Gate, Pegel, Testmodus und Kalibrierung. */
export function MicSettings() {
  const v = useSettings((s) => s.voice);
  const update = useSettings((s) => s.update);
  const status = useVoice((s) => s.status);
  const testMode = useVoice((s) => s.testMode);
  const [vocab, setVocab] = useState<Set<string> | null>(null);
  const [vocabError, setVocabError] = useState(false);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    loadVocab().then(setVocab, () => setVocabError(true));
  }, []);

  const known = (w: string) => (vocab ? vocab.has(w.toLowerCase()) : null);
  const customKnown = custom ? known(custom.trim()) : null;

  return (
    <>
      <div className="row mic-trigger">
        <span className="label">
          Triggerwort
          <small>Nur Wörter, die das Sprachmodell kennt.</small>
        </span>
        <div className="segmented setup-wrap">
          {TRIGGER_SUGGESTIONS.map((w) => (
            <button
              key={w}
              aria-pressed={v.trigger === w}
              disabled={known(w) === false}
              onClick={() => update('voice', { trigger: w })}
            >
              {capitalize(w)}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="label" htmlFor="custom-trigger">
          Eigenes Triggerwort
          {customKnown === true && <small className="ok">Kennt das Modell.</small>}
          {customKnown === false && <small className="warn">Kennt das Modell nicht.</small>}
          {vocabError && <small className="warn">Wortliste nicht geladen – Prüfung nicht möglich.</small>}
        </label>
        <input
          id="custom-trigger"
          type="text"
          value={custom}
          placeholder={capitalize(v.trigger)}
          onChange={(e) => setCustom(e.target.value)}
          autoCapitalize="none"
        />
        <button
          className="btn"
          disabled={!custom.trim() || customKnown !== true}
          onClick={() => {
            update('voice', { trigger: custom.trim().toLowerCase() });
            setCustom('');
          }}
        >
          Übernehmen
        </button>
      </div>

      <Range
        label="Mikro-Verstärkung"
        hint="Die Systemlautstärke des Mikros kann eine Web-App nicht ändern – die Verstärkung passiert hier in der App."
        min={0}
        max={30}
        step={1}
        value={v.gainDb}
        format={(x) => `+${x} dB`}
        onChange={(x) => update('voice', { gainDb: x })}
      />
      <Range
        label="Noise Gate"
        hint="Alles leiser als diese Schwelle (Dart-Einschläge, Hintergrund) wird ausgeblendet."
        min={-80}
        max={-20}
        step={1}
        value={v.gateDb}
        format={(x) => `${x} dB`}
        onChange={(x) => update('voice', { gateDb: x })}
      />
      <Toggle
        label="Rauschunterdrückung des Geräts"
        checked={v.noiseSuppression}
        onChange={(x) => update('voice', { noiseSuppression: x })}
      />
      <Toggle
        label="Automatische Pegelanpassung des Geräts"
        hint="Meist aus besser: Sie dreht in Pausen das Rauschen hoch."
        checked={v.autoGainControl}
        onChange={(x) => update('voice', { autoGainControl: x })}
      />

      <div className="row mic-test">
        <div className="label">
          Pegel und Testmodus
          <small>
            Sprich aus 3 m Entfernung – du siehst Pegel und erkannten Text, ohne dass etwas gezählt wird.
          </small>
          {status === 'off' ? (
            <button className="btn" onClick={() => void startVoice()}>
              Mikro starten
            </button>
          ) : (
            <>
              <LevelMeter gateDb={v.gateDb} />
              <label className="mic-testmode">
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => useVoice.getState().set({ testMode: e.target.checked })}
                />
                Testmodus (nichts zählen)
              </label>
              <VoiceLog limit={5} />
            </>
          )}
        </div>
      </div>
      <div className="row">
        <div className="label">
          Kalibrieren
          <Calibration />
        </div>
      </div>
    </>
  );
}
