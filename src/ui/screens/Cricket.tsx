import { useMemo } from 'react';
import { emitFeedback } from '../../app/feedback';
import {
  CRICKET_TARGETS,
  cricketLabel,
  isClosed,
  marksPerRound,
  reduceCricket,
  type CricketDart,
  type CricketTarget,
} from '../../engine/cricket';
import { useCricket } from '../../store/cricket';
import { useSettings } from '../../store/settings';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import './arena.css';
import './arena-fire.css';
import './cricket.css';

/** Marks wie auf der Kreidetafel: / , X , ⊗ */
function Marks({ n }: { n: number }) {
  const m = Math.min(3, n);
  return (
    <svg className="ck-marks" viewBox="0 0 24 24" aria-label={`${m} von 3`} data-n={m}>
      {m >= 1 && <line x1="6" y1="18" x2="18" y2="6" />}
      {m >= 2 && <line x1="6" y1="6" x2="18" y2="18" />}
      {m >= 3 && <circle cx="12" cy="12" r="10" />}
    </svg>
  );
}

function dartLabel(d: CricketDart): string {
  if (d.target === 0) return '–';
  if (d.target === 25) return d.marks === 2 ? 'Bull' : '25';
  return `${d.marks === 3 ? 'T' : d.marks === 2 ? 'D' : 'S'}${d.target}`;
}

export function Cricket() {
  const names = useCricket((s) => s.names);
  const events = useCricket((s) => s.events);
  const { dart, endVisit, undo, close, start } = useCricket.getState();
  const arenaStyle = useSettings((s) => s.display.arena);
  const state = useMemo(() => reduceCricket(names.length, events), [names.length, events]);

  if (names.length === 0) {
    return (
      <div className="screen">
        <p className="hint">Kein Cricket-Spiel aktiv.</p>
        <button className="btn btn-primary" onClick={() => navigate('training')}>
          Zu den Minigames
        </button>
      </div>
    );
  }

  const throwDart = (d: CricketDart) => {
    const before = state.winner;
    dart(d);
    const after = reduceCricket(names.length, [...events, d]);
    emitFeedback({ type: 'cricketDart', marks: d.marks });
    if (before === null && after.winner !== null)
      emitFeedback({ type: 'cricketWon', name: names[after.winner]! });
  };

  const cur = state.current;
  const over = state.winner !== null;
  const visitSlots = [0, 1, 2].map((i) => state.visit[i]);

  return (
    <div
      className="cricket arena"
      data-arena={arenaStyle}
      style={{ '--n': names.length } as React.CSSProperties}
    >
      <header className="game-top">
        <button
          className="icon-btn"
          aria-label="Cricket beenden"
          onClick={() => {
            close();
            navigate('training');
          }}
        >
          <Icon name="close" />
        </button>
        <span className="game-meta">
          Cricket <span className="game-meta-dim">Runde {state.round}</span>
        </span>
        <button className="icon-btn" aria-label="Wurf zurück" onClick={undo} disabled={events.length === 0}>
          <Icon name="undo" />
        </button>
      </header>

      <section className="ck-board card" aria-label="Cricket-Tafel">
        <div className="ck-row ck-head">
          <span className="ck-target" />
          {names.map((n, i) => (
            <span key={i} className="ck-player" aria-current={i === cur && !over ? 'true' : undefined}>
              <span className="ck-name">{n}</span>
              <span className="ck-points" data-testid={`ck-points-${i}`}>
                {state.players[i]!.points}
              </span>
              <span className="ck-mpr">MPR {marksPerRound(events, names.length, i).toFixed(1)}</span>
            </span>
          ))}
          <span className="ck-keys-head" aria-hidden="true" />
        </div>
        {CRICKET_TARGETS.map((t: CricketTarget) => {
          const dead = state.players.every((p) => isClosed(p, t));
          const keys = t === 25 ? ([1, 2] as const) : ([1, 2, 3] as const);
          return (
            <div key={t} className="ck-row" data-dead={dead || undefined}>
              <span className="ck-target">{cricketLabel(t)}</span>
              {state.players.map((p, i) => (
                <span key={i} className="ck-cell" aria-current={i === cur && !over ? 'true' : undefined}>
                  <Marks n={p.marks[t]} />
                </span>
              ))}
              <span className="ck-keys">
                {keys.map((m) => (
                  <button
                    key={m}
                    className="ck-key"
                    data-m={m}
                    disabled={over}
                    aria-label={
                      t === 25
                        ? m === 2
                          ? 'Bull'
                          : 'Single Bull'
                        : `${['', 'Single', 'Double', 'Triple'][m]} ${t}`
                    }
                    onClick={() => throwDart({ target: t, marks: m })}
                  >
                    {t === 25 ? (m === 2 ? '50' : '25') : ['', 'S', 'D', 'T'][m]}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </section>

      <nav className="ck-bar card" aria-label="Aufnahme">
        <span className="ck-visit" aria-label="Diese Aufnahme">
          {visitSlots.map((d, i) => (
            <span key={i} className="ck-slot" data-filled={d ? 'true' : undefined}>
              {d ? dartLabel(d) : ''}
            </span>
          ))}
        </span>
        <button className="btn" disabled={over} onClick={() => throwDart({ target: 0, marks: 0 })}>
          Daneben
        </button>
        <button className="btn btn-primary" disabled={over} onClick={endVisit}>
          Fertig
        </button>
      </nav>

      {over && (
        <div className="sheet" role="dialog" aria-label="Cricket vorbei">
          <h2>{names[state.winner!]} gewinnt</h2>
          <button className="btn btn-primary" onClick={() => start([...names.slice(1), names[0]!])}>
            Revanche
          </button>
          <button
            className="btn"
            onClick={() => {
              close();
              navigate('training');
            }}
          >
            Zu den Minigames
          </button>
        </div>
      )}
    </div>
  );
}
