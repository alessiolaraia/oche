import { useSettings } from '../../store/settings';
import type { CallerStyle, EnginePreference, VoiceMode } from '../../settings/types';
import { Calibration } from '../components/Calibration';
import { capitalize, Choice, Range, Toggle } from '../components/controls';
import { Icon } from '../components/Icon';
import { MicSetup } from '../components/MicSetup';
import { TriggerCustom } from '../components/TriggerCustom';
import { VoicePicker } from '../components/VoicePicker';

/** Einstellungen: das Wichtige oben in vier Karten, alles Feine unter „Erweitert“. */
export function Settings() {
  const s = useSettings();
  const { game, voice, caller, display } = s;

  return (
    <div className="screen settings">
      <header className="screen-head">
        <a className="icon-btn" href="#/" onClick={backIfPossible} aria-label="Zurück">
          <Icon name="back" />
        </a>
        <h1>Einstellungen</h1>
      </header>

      <h2 className="card-title">Mikrofon</h2>
      <div className="card">
        <MicSetup />
      </div>

      <h2 className="card-title">Sprache</h2>
      <div className="card">
        <Toggle
          label="Spracheingabe"
          checked={voice.enabled}
          onChange={(v) => s.update('voice', { enabled: v })}
        />
        <Choice<VoiceMode>
          full
          label="Wann zählt eine Zahl?"
          hint={
            voice.mode === 'trigger'
              ? `Nur mit Triggerwort: „${capitalize(voice.trigger)} sechzig“ – gut, wenn am Tisch geredet wird.`
              : 'Die Zahl allein reicht – fürs Training allein.'
          }
          value={voice.mode}
          options={{ trigger: 'Mit Triggerwort', direct: 'Zahl allein' }}
          onChange={(v) => s.update('voice', { mode: v })}
        />
        {voice.mode === 'trigger' && <TriggerCustom />}
      </div>

      <h2 className="card-title">Ansagen</h2>
      <div className="card">
        <Toggle
          label="Ansagen"
          checked={caller.enabled}
          onChange={(v) => s.update('caller', { enabled: v })}
        />
        <Choice<CallerStyle>
          full
          label="Stil"
          hint={
            caller.style === 'plain'
              ? 'Deutsch: „Sechzig. Rest vierhunderteinundvierzig.“'
              : 'Englisch wie in der Halle: „One hundred and eighty!“'
          }
          value={caller.style}
          options={{ plain: 'Nüchtern', arena: 'Arena' }}
          onChange={(v) => s.update('caller', { style: v })}
        />
        <Range
          label="Lautstärke"
          min={0}
          max={1}
          step={0.05}
          value={caller.volume}
          format={(v) => `${Math.round(v * 100)} %`}
          onChange={(v) => s.update('caller', { volume: v })}
        />
      </div>

      <h2 className="card-title">Spiel</h2>
      <div className="card">
        <Toggle
          label="Nach Checkout fragen"
          hint="„Mit wie vielen Darts?“ – für genaue Statistik."
          checked={game.askCheckoutDarts}
          onChange={(v) => s.update('game', { askCheckoutDarts: v })}
        />
        <Toggle
          label="Bildschirm anlassen"
          checked={display.keepAwake}
          onChange={(v) => s.update('display', { keepAwake: v })}
        />
      </div>

      <div className="card">
        <details className="more">
          <summary>Erweitert</summary>
          <div className="advanced">
            <h3 className="card-title">Mikrofon fein einstellen</h3>
            <Range
              label="Verstärkung"
              hint="Die Systemlautstärke des Mikros kann eine Web-App nicht ändern – verstärkt wird in der App."
              min={0}
              max={30}
              step={1}
              value={voice.gainDb}
              format={(x) => `+${x} dB`}
              onChange={(x) => s.update('voice', { gainDb: x })}
            />
            <Range
              label="Noise Gate"
              hint="Leiser als diese Schwelle (Einschläge, Hintergrund) wird ausgeblendet."
              min={-80}
              max={-20}
              step={1}
              value={voice.gateDb}
              format={(x) => `${x} dB`}
              onChange={(x) => s.update('voice', { gateDb: x })}
            />
            <div className="stack">
              <span className="label">
                Automatisch messen
                <small>Misst Raum und Stimme und stellt beides genauer ein.</small>
              </span>
              <Calibration />
            </div>
            <Toggle
              label="Rauschunterdrückung des Geräts"
              checked={voice.noiseSuppression}
              onChange={(x) => s.update('voice', { noiseSuppression: x })}
            />
            <Toggle
              label="Automatische Pegelanpassung des Geräts"
              hint="Meist aus besser: Sie dreht in Pausen das Rauschen hoch."
              checked={voice.autoGainControl}
              onChange={(x) => s.update('voice', { autoGainControl: x })}
            />

            <h3 className="card-title">Erkennung</h3>
            <Choice<EnginePreference>
              full
              label="Spracherkennung"
              hint="Automatisch: offline auf dem Gerät, sonst die des Browsers."
              value={voice.engine}
              options={{ auto: 'Automatisch', vosk: 'Offline', webspeech: 'Browser' }}
              onChange={(v) => s.update('voice', { engine: v })}
            />
            <Range
              label="Mindest-Sicherheit"
              hint="Höher = weniger Fehlerkennungen, aber öfter „nicht verstanden“."
              min={0}
              max={0.95}
              step={0.05}
              value={voice.minConfidence}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => s.update('voice', { minConfidence: v })}
            />
            <Range
              label="Zeit für „Nein“"
              min={1000}
              max={6000}
              step={500}
              value={voice.confirmWindowMs}
              format={(v) => `${(v / 1000).toFixed(1).replace('.', ',')} s`}
              onChange={(v) => s.update('voice', { confirmWindowMs: v })}
            />

            <h3 className="card-title">Stimme und Ansagen</h3>
            <VoicePicker />
            <Range
              label="Tempo"
              min={0.6}
              max={1.6}
              step={0.05}
              value={caller.rate}
              format={(v) => v.toFixed(2).replace('.', ',')}
              onChange={(v) => s.update('caller', { rate: v })}
            />
            <Range
              label="Tonhöhe"
              min={0.5}
              max={1.5}
              step={0.05}
              value={caller.pitch}
              format={(v) => v.toFixed(2).replace('.', ',')}
              onChange={(v) => s.update('caller', { pitch: v })}
            />
            <Toggle
              label="Punktzahl ansagen"
              checked={caller.announceScore}
              onChange={(v) => s.update('caller', { announceScore: v })}
            />
            <Toggle
              label="Rest ansagen"
              checked={caller.announceRemaining}
              onChange={(v) => s.update('caller', { announceRemaining: v })}
            />
            <Toggle
              label="Ansagen, wer dran ist"
              checked={caller.announceTurn}
              onChange={(v) => s.update('caller', { announceTurn: v })}
            />
            <Toggle
              label="Checkout-Weg ansagen"
              checked={caller.announceCheckoutRoute}
              onChange={(v) => s.update('caller', { announceCheckoutRoute: v })}
            />
            <Toggle
              label="Besondere Ansagen (180, Highfinish, Match)"
              checked={caller.specialCalls}
              onChange={(v) => s.update('caller', { specialCalls: v })}
            />
            <Toggle
              label="Soundeffekte"
              checked={caller.sfx}
              onChange={(v) => s.update('caller', { sfx: v })}
            />

            <h3 className="card-title">Spiel und Anzeige</h3>
            <Toggle
              label="Auch fragen: „Darts auf Doppel?“"
              hint="Für eine genaue Checkout-Quote."
              checked={game.askDartsAtDouble}
              onChange={(v) => s.update('game', { askDartsAtDouble: v })}
            />
            <Toggle
              label="Checkout-Weg anzeigen"
              checked={display.showCheckoutRoute}
              onChange={(v) => s.update('display', { showCheckoutRoute: v })}
            />
            <Toggle
              label="Einzeldart-Pad statt Zahlenpad"
              checked={display.boardPad}
              onChange={(v) => s.update('display', { boardPad: v })}
            />

            <h3 className="card-title">Hilfe</h3>
            <div className="advanced-links">
              <a className="btn" href="#/onboarding">
                Einrichtung erneut durchgehen
              </a>
              <a className="btn" href="#/debug">
                Diagnose
              </a>
              <button
                className="btn"
                onClick={() => confirm('Alle Einstellungen zurücksetzen?') && s.reset()}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function backIfPossible(e: React.MouseEvent) {
  if (history.length > 1) {
    e.preventDefault();
    history.back();
  }
}
