import { useState } from 'react';
import { startMatch } from '../../app/controller';
import type { InMode, MatchConfig, OutMode, Player } from '../../engine/types';
import { newId } from '../../store/match';
import { useSettings } from '../../store/settings';
import { startVoice } from '../../voice/control';
import { Choice } from '../components/controls';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import './setup.css';

const START_SCORES = [101, 301, 501, 701, 901, 1001];
const MODE_LABEL: Record<InMode | OutMode, string> = {
  straight: 'Straight',
  double: 'Double',
  master: 'Master',
};

export function Setup() {
  const settings = useSettings();
  const g = settings.game;
  const [names, setNames] = useState<string[]>(settings.players.recent.slice(0, 8));
  const [bots, setBots] = useState<Record<number, number>>({});
  const [more, setMore] = useState(false);

  const go = (config: MatchConfig) => {
    settings.update('players', { recent: config.players.filter((p) => !p.bot).map((p) => p.name) });
    startMatch(config);
    // Tippen auf Start ist die Nutzergeste, die Mikro und Audio freischaltet
    if (settings.voice.enabled) void startVoice();
    navigate('game');
  };

  const players = (list: string[]): Player[] =>
    list.map((name, i) => ({
      id: newId(),
      name: name.trim() || `Spieler ${i + 1}`,
      ...(bots[i] ? { bot: { average: bots[i]! } } : {}),
    }));

  const quickStart = () =>
    go({
      startScore: 501,
      inMode: 'straight',
      outMode: 'double',
      legs: { mode: 'firstTo', count: 3 },
      sets: null,
      players: players(names.length >= 2 ? names.slice(0, 2) : [names[0] ?? 'Spieler 1', 'Spieler 2']),
      startOrder: 'alternate',
    });

  const customStart = () =>
    go({
      startScore: g.startScore,
      inMode: g.inMode,
      outMode: g.outMode,
      legs: g.legs,
      sets: g.sets,
      players: players(names),
      startOrder: g.startOrder,
    });

  const first = names[0]?.trim() || 'Spieler 1';
  const second = names[1]?.trim() || 'Spieler 2';

  return (
    <div className="screen setup">
      <header className="setup-head">
        <span className="setup-brand">
          <span className="setup-mark" aria-hidden="true" />
          Oche
        </span>
        <nav className="setup-nav" aria-label="Bereiche">
          <a className="icon-btn" href="#/stats" aria-label="Statistik">
            <Icon name="chart" />
          </a>
          <a className="icon-btn" href="#/training" aria-label="Training">
            <Icon name="target" />
          </a>
          <a className="icon-btn" href="#/settings" aria-label="Einstellungen">
            <Icon name="settings" />
          </a>
        </nav>
      </header>

      <h1 className="sg-hero setup-hero">
        Darts zählen,
        <br />
        nur mit der Stimme.
      </h1>

      <section className="card setup-quick" aria-label="Schnellstart">
        <div className="sg-aura setup-aura" aria-hidden="true" />
        <div className="setup-quick-head">
          <span className="setup-quick-score">501</span>
          <span className="setup-quick-text">
            <strong>
              {first} gegen {second}
            </strong>
            <small>Double-Out, First to 3 Legs</small>
          </span>
        </div>
        <button className="btn btn-primary btn-block" onClick={quickStart} data-testid="quick-start">
          Spiel starten
        </button>
      </section>

      <h2 className="card-title">Spieler</h2>
      <div className="card">
        <ol className="setup-players">
          {names.map((n, i) => (
            <li key={i} className="row">
              <input
                type="text"
                value={n}
                aria-label={`Name Spieler ${i + 1}`}
                onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))}
              />
              <label className="setup-bot">
                Bot
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Bot"
                  checked={bots[i] !== undefined}
                  onChange={(e) => {
                    const rest = Object.fromEntries(Object.entries(bots).filter(([k]) => Number(k) !== i));
                    setBots(e.target.checked ? { ...rest, [i]: 60 } : rest);
                  }}
                />
              </label>
              {bots[i] !== undefined && (
                <label className="setup-bot-avg">
                  Ø
                  <input
                    type="number"
                    min={20}
                    max={110}
                    value={bots[i]}
                    aria-label="Ziel-Average des Bots"
                    onChange={(e) => setBots({ ...bots, [i]: Number(e.target.value) })}
                  />
                </label>
              )}
              <button
                className="icon-btn setup-remove"
                aria-label="Entfernen"
                disabled={names.length <= 1}
                onClick={() => setNames(names.filter((_, k) => k !== i))}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ol>
        {names.length < 8 && (
          <div className="row">
            <button
              className="btn btn-quiet"
              onClick={() => setNames([...names, `Spieler ${names.length + 1}`])}
            >
              + Spieler hinzufügen
            </button>
          </div>
        )}
      </div>

      <button className="btn btn-block setup-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Weniger Optionen' : 'Spielmodus anpassen'}
      </button>

      {more && (
        <div className="card">
          <Choice<string>
            full
            label="Startpunkte"
            value={String(g.startScore)}
            options={Object.fromEntries(START_SCORES.map((s) => [String(s), String(s)]))}
            onChange={(v) => settings.update('game', { startScore: Number(v) })}
          />
          <label className="row">
            <span className="label">Eigene Startpunktzahl</span>
            <input
              className="setup-count"
              type="number"
              min={2}
              max={9999}
              placeholder="frei"
              aria-label="Freie Startpunktzahl"
              value={START_SCORES.includes(g.startScore) ? '' : g.startScore}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v >= 2) settings.update('game', { startScore: v });
              }}
            />
          </label>
          <Choice<OutMode>
            full
            label="Auschecken"
            value={g.outMode}
            options={MODE_LABEL}
            onChange={(v) => settings.update('game', { outMode: v })}
          />
          <Choice<InMode>
            full
            label="Einsteigen"
            value={g.inMode}
            options={MODE_LABEL}
            onChange={(v) => settings.update('game', { inMode: v })}
          />
          <div className="row">
            <span className="label">Legs</span>
            <div className="segmented">
              <button
                aria-pressed={g.legs.mode === 'firstTo'}
                onClick={() => settings.update('game', { legs: { ...g.legs, mode: 'firstTo' } })}
              >
                First to
              </button>
              <button
                aria-pressed={g.legs.mode === 'bestOf'}
                onClick={() => settings.update('game', { legs: { ...g.legs, mode: 'bestOf' } })}
              >
                Best of
              </button>
            </div>
            <input
              className="setup-count"
              type="number"
              min={1}
              max={21}
              value={g.legs.count}
              aria-label="Anzahl Legs"
              onChange={(e) =>
                settings.update('game', { legs: { ...g.legs, count: Math.max(1, Number(e.target.value)) } })
              }
            />
          </div>
          <label className="row">
            <span className="label">Mit Sets</span>
            <input
              type="checkbox"
              role="switch"
              checked={g.sets !== null}
              onChange={(e) =>
                settings.update('game', { sets: e.target.checked ? { mode: 'firstTo', count: 2 } : null })
              }
            />
          </label>
          {g.sets && (
            <div className="row">
              <span className="label">Sets (First to)</span>
              <input
                className="setup-count"
                type="number"
                min={1}
                max={13}
                value={g.sets.count}
                aria-label="Anzahl Sets"
                onChange={(e) =>
                  settings.update('game', {
                    sets: { ...g.sets!, count: Math.max(1, Number(e.target.value)) },
                  })
                }
              />
            </div>
          )}
          <Choice<'alternate' | 'bullOut'>
            full
            label="Wer beginnt?"
            value={g.startOrder}
            options={{ alternate: 'Reihenfolge', bullOut: 'Bull-Out' }}
            onChange={(v) => settings.update('game', { startOrder: v })}
          />
        </div>
      )}

      <button
        className="btn btn-primary btn-block setup-start"
        onClick={customStart}
        data-testid="custom-start"
      >
        {g.startScore} mit {names.length} {names.length === 1 ? 'Spieler' : 'Spielern'} starten
      </button>
    </div>
  );
}
