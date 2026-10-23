import { useState } from 'react';
import { startMatch } from '../../app/controller';
import type { InMode, MatchConfig, OutMode, Player } from '../../engine/types';
import { newId, useMatch } from '../../store/match';
import { useSettings } from '../../store/settings';
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
  const canResume = useMatch((m) => m.state !== null && m.state.winner === null);
  const [customScore, setCustomScore] = useState('');

  const go = (config: MatchConfig) => {
    settings.update('players', { recent: config.players.filter((p) => !p.bot).map((p) => p.name) });
    startMatch(config);
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
      players: players(names.slice(0, 2).length === 2 ? names.slice(0, 2) : ['Spieler 1', 'Spieler 2']),
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

  return (
    <div className="screen setup">
      <header className="setup-head">
        <h1 className="setup-brand">Oche</h1>
        <nav className="setup-nav">
          <a href="#/stats">Statistik</a>
          <a href="#/training">Training</a>
          <a href="#/settings">Einstellungen</a>
        </nav>
      </header>

      {canResume && (
        <button className="btn setup-resume" onClick={() => navigate('game')}>
          Laufendes Spiel fortsetzen
        </button>
      )}

      <button className="setup-quick" onClick={quickStart} data-testid="quick-start">
        <span className="setup-quick-score">501</span>
        <span className="setup-quick-text">
          {names[0] || 'Spieler 1'} gegen {names[1] || 'Spieler 2'}
          <small>Double-Out, First to 3 Legs</small>
        </span>
      </button>

      <h2 className="section-title">Spieler</h2>
      <ol className="list setup-players">
        {names.map((n, i) => (
          <li key={i} className="row">
            <input
              type="text"
              value={n}
              aria-label={`Name Spieler ${i + 1}`}
              onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))}
            />
            <label className="setup-bot">
              <input
                type="checkbox"
                checked={bots[i] !== undefined}
                onChange={(e) => {
                  const rest = Object.fromEntries(Object.entries(bots).filter(([k]) => Number(k) !== i));
                  setBots(e.target.checked ? { ...rest, [i]: 60 } : rest);
                }}
              />
              Bot
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
            <span className="setup-player-actions">
              <button
                className="btn btn-quiet"
                aria-label="Nach oben"
                disabled={i === 0}
                onClick={() => {
                  const next = [...names];
                  [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                  setNames(next);
                }}
              >
                ↑
              </button>
              <button
                className="btn btn-quiet"
                aria-label="Entfernen"
                disabled={names.length <= 1}
                onClick={() => setNames(names.filter((_, k) => k !== i))}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      {names.length < 8 && (
        <button className="btn" onClick={() => setNames([...names, `Spieler ${names.length + 1}`])}>
          Spieler hinzufügen
        </button>
      )}

      <button className="btn btn-quiet setup-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Weniger Optionen' : 'Spielmodus anpassen'}
      </button>

      {more && (
        <div className="list">
          <div className="row">
            <span className="label">Startpunkte</span>
            <div className="segmented setup-wrap">
              {START_SCORES.map((s) => (
                <button
                  key={s}
                  aria-pressed={g.startScore === s}
                  onClick={() => settings.update('game', { startScore: s })}
                >
                  {s}
                </button>
              ))}
              <input
                type="number"
                className="setup-custom-score"
                placeholder="frei"
                aria-label="Freie Startpunktzahl"
                value={customScore}
                min={2}
                max={9999}
                onChange={(e) => {
                  setCustomScore(e.target.value);
                  const v = Number(e.target.value);
                  if (Number.isInteger(v) && v >= 2) settings.update('game', { startScore: v });
                }}
              />
            </div>
          </div>
          <div className="row">
            <span className="label">In</span>
            <Seg
              value={g.inMode}
              options={['straight', 'double', 'master']}
              labels={MODE_LABEL}
              onChange={(v) => settings.update('game', { inMode: v })}
            />
          </div>
          <div className="row">
            <span className="label">Out</span>
            <Seg
              value={g.outMode}
              options={['straight', 'double', 'master']}
              labels={MODE_LABEL}
              onChange={(v) => settings.update('game', { outMode: v })}
            />
          </div>
          <div className="row">
            <span className="label">Legs</span>
            <Seg
              value={g.legs.mode}
              options={['firstTo', 'bestOf']}
              labels={{ firstTo: 'First to', bestOf: 'Best of' }}
              onChange={(v) => settings.update('game', { legs: { ...g.legs, mode: v } })}
            />
            <input
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
          <div className="row">
            <label htmlFor="sets-on" className="label">
              Mit Sets
            </label>
            <input
              id="sets-on"
              type="checkbox"
              checked={g.sets !== null}
              onChange={(e) =>
                settings.update('game', { sets: e.target.checked ? { mode: 'firstTo', count: 2 } : null })
              }
            />
            {g.sets && (
              <>
                <Seg
                  value={g.sets.mode}
                  options={['firstTo', 'bestOf']}
                  labels={{ firstTo: 'First to', bestOf: 'Best of' }}
                  onChange={(v) => settings.update('game', { sets: { ...g.sets!, mode: v } })}
                />
                <input
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
              </>
            )}
          </div>
          <div className="row">
            <span className="label">Wer beginnt</span>
            <Seg
              value={g.startOrder}
              options={['alternate', 'bullOut']}
              labels={{ alternate: 'Reihenfolge', bullOut: 'Bull-Out' }}
              onChange={(v) => settings.update('game', { startOrder: v })}
            />
          </div>
        </div>
      )}

      <button className="btn btn-primary setup-start" onClick={customStart} data-testid="custom-start">
        {g.startScore} starten ({names.length} {names.length === 1 ? 'Spieler' : 'Spieler'})
      </button>
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Partial<Record<T, string>>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
          {labels[o] ?? o}
        </button>
      ))}
    </div>
  );
}
