import { useSettings } from '../../store/settings';
import type { CallerStyle, EnginePreference, Theme, VoiceMode } from '../../settings/types';
import { capitalize, Choice, Range, Toggle } from '../components/controls';
import { MicSettings } from '../components/MicSettings';
import { VoicePicker } from '../components/VoicePicker';

export function Settings() {
  const s = useSettings();
  const { game, voice, caller, display } = s;

  return (
    <div className="screen settings">
      <header className="screen-head">
        <h1>Einstellungen</h1>
        <a className="link-back" href="#/" onClick={backIfPossible}>
          Zurück
        </a>
      </header>

      <h2 className="section-title">Spiel</h2>
      <div className="list">
        <Toggle
          label="Nach Checkout fragen: „Mit wie vielen Darts?“"
          checked={game.askCheckoutDarts}
          onChange={(v) => s.update('game', { askCheckoutDarts: v })}
        />
        <Toggle
          label="Zusätzlich fragen: „Darts auf Doppel?“"
          hint="Für eine genaue Checkout-Quote."
          checked={game.askDartsAtDouble}
          onChange={(v) => s.update('game', { askDartsAtDouble: v })}
        />
        <p className="row hint">Startpunkte, In/Out und Format stellst du auf dem Startbildschirm ein.</p>
      </div>

      <h2 className="section-title">Spieler</h2>
      <div className="list">
        {s.players.recent.map((name, i) => (
          <div className="row" key={i}>
            <input
              type="text"
              value={name}
              aria-label={`Gespeicherter Name ${i + 1}`}
              onChange={(e) =>
                s.update('players', {
                  recent: s.players.recent.map((n, k) => (k === i ? e.target.value : n)),
                })
              }
            />
          </div>
        ))}
      </div>

      <h2 className="section-title">Sprache und Mikro</h2>
      <div className="list">
        <Toggle
          label="Spracheingabe"
          checked={voice.enabled}
          onChange={(v) => s.update('voice', { enabled: v })}
        />
        <Choice<VoiceMode>
          label="Modus"
          hint={
            voice.mode === 'trigger'
              ? `Nur „${capitalize(voice.trigger)} sechzig“ zählt – gut, wenn am Tisch geredet wird.`
              : 'Die Zahl allein reicht – fürs Solo-Training.'
          }
          value={voice.mode}
          options={{ trigger: 'Triggerwort', direct: 'Direkt' }}
          onChange={(v) => s.update('voice', { mode: v })}
        />
        <Choice<EnginePreference>
          label="Erkennung"
          hint="Automatisch: offline mit Vosk, sonst Spracherkennung des Browsers."
          value={voice.engine}
          options={{ auto: 'Automatisch', vosk: 'Vosk', webspeech: 'Browser' }}
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
          label="Bestätigungsfenster für „Nein“"
          min={1000}
          max={6000}
          step={500}
          value={voice.confirmWindowMs}
          format={(v) => `${(v / 1000).toFixed(1).replace('.', ',')} s`}
          onChange={(v) => s.update('voice', { confirmWindowMs: v })}
        />
        <Toggle
          label="Einzeldarts erkennen"
          hint="„Triple zwanzig, Doppel zehn, Single fünf“"
          checked={voice.singleDarts}
          onChange={(v) => s.update('voice', { singleDarts: v })}
        />
        <MicSettings />
      </div>

      <h2 className="section-title">Stimme</h2>
      <div className="list">
        <Toggle
          label="Ansagen"
          checked={caller.enabled}
          onChange={(v) => s.update('caller', { enabled: v })}
        />
        <Choice<CallerStyle>
          label="Stil"
          hint={
            caller.style === 'plain'
              ? '„Sechzig. Rest vierhunderteinundvierzig.“'
              : 'Englischer Ansager: „One hundred and eighty!“'
          }
          value={caller.style}
          options={{ plain: 'Nüchtern', arena: 'Arena' }}
          onChange={(v) => s.update('caller', { style: v })}
        />
        <VoicePicker />
        <Range
          label="Tempo"
          min={0.6}
          max={1.6}
          step={0.05}
          value={caller.rate}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.update('caller', { rate: v })}
        />
        <Range
          label="Tonhöhe"
          min={0.5}
          max={1.5}
          step={0.05}
          value={caller.pitch}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.update('caller', { pitch: v })}
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
        <Toggle label="Soundeffekte" checked={caller.sfx} onChange={(v) => s.update('caller', { sfx: v })} />
      </div>

      <h2 className="section-title">Darstellung</h2>
      <div className="list">
        <Choice<Theme>
          label="Farbschema"
          hint="Hell für helle Räume."
          value={display.theme}
          options={{ dark: 'Dunkel', light: 'Hell' }}
          onChange={(v) => s.update('display', { theme: v })}
        />
        <Toggle
          label="Checkout-Weg anzeigen"
          checked={display.showCheckoutRoute}
          onChange={(v) => s.update('display', { showCheckoutRoute: v })}
        />
        <Toggle
          label="Bildschirm im Spiel anlassen"
          checked={display.keepAwake}
          onChange={(v) => s.update('display', { keepAwake: v })}
        />
        <Toggle
          label="Einzeldart-Pad statt Zahlenpad"
          checked={display.boardPad}
          onChange={(v) => s.update('display', { boardPad: v })}
        />
        <div className="row">
          <a href="#/onboarding">Einrichtung erneut durchgehen</a>
        </div>
        <div className="row">
          <a href="#/debug">Diagnose</a>
        </div>
        <div className="row">
          <button
            className="btn btn-danger"
            onClick={() => confirm('Alle Einstellungen zurücksetzen?') && s.reset()}
          >
            Einstellungen zurücksetzen
          </button>
        </div>
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
