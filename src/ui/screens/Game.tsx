import { useState } from 'react';
import {
  answerQuestion,
  dismissQuestion,
  restartLeg,
  setStarter,
  startMatch,
  submitDarts,
  submitVisit,
  undo,
} from '../../app/controller';
import { checkoutRoute, formatRoute } from '../../engine/checkouts';
import { matchStats } from '../../engine/stats';
import type { MatchState } from '../../engine/types';
import { useMatch } from '../../store/match';
import { useSession } from '../../store/session';
import { useSettings } from '../../store/settings';
import { BigNumber } from '../components/BigNumber';
import { BoardPad } from '../components/BoardPad';
import { MicButton } from '../components/MicButton';
import { NumberPad } from '../components/NumberPad';
import { navigate } from '../router';
import './game.css';

function fmtAvg(n: number | null): string {
  return n === null ? '–' : n.toFixed(1).replace('.', ',');
}

function scoreLine(state: MatchState): string {
  const p = state.players;
  if (p.length !== 2) return `Leg ${state.legInSet}`;
  const legs = `Legs ${p[0]!.legsWon}:${p[1]!.legsWon}`;
  return state.config.sets ? `Sets ${p[0]!.setsWon}:${p[1]!.setsWon}, ${legs}` : legs;
}

export function Game() {
  const state = useMatch((s) => s.state);
  const events = useMatch((s) => s.events);
  const config = useMatch((s) => s.config);
  const question = useSession((s) => s.question);
  const showRoute = useSettings((s) => s.display.showCheckoutRoute);
  const boardPadDefault = useSettings((s) => s.display.boardPad);
  const [pad, setPad] = useState<'none' | 'numbers' | 'board'>('none');
  const [menu, setMenu] = useState(false);

  if (!state || !config) {
    return (
      <div className="screen">
        <p>Kein Spiel aktiv.</p>
        <button className="btn btn-primary" onClick={() => navigate('setup')}>
          Spiel einrichten
        </button>
      </div>
    );
  }

  const cur = state.current;
  const me = state.players[cur]!;
  const meCfg = config.players[cur]!;
  const route = me.isIn ? checkoutRoute(me.remaining, config.outMode) : null;
  const needsBullOut = config.startOrder === 'bullOut' && events.length === 0;
  const last = state.lastVisit;
  const others = state.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== cur);

  if (state.winner !== null) return <MatchOver state={state} />;

  return (
    <div className={`game${pad !== 'none' ? ' game-with-pad' : ''}`}>
      <header className="game-head">
        <h1 className="game-player" data-testid="active-player">
          {meCfg.name}
        </h1>
        <span className="game-score">{scoreLine(state)}</span>
      </header>

      <section className="game-number" aria-label={`${meCfg.name}: Rest ${me.remaining}`}>
        <BigNumber value={me.remaining} label={`Rest ${me.remaining}`} />
      </section>

      <section className="game-info">
        <p className="game-route" data-testid="checkout-route">
          {showRoute && route ? formatRoute(route) : ' '}
        </p>
        <p className="game-last">
          {last ? (
            <>
              zuletzt {config.players[last.player]!.name}: {last.bust ? 'Bust' : last.scored}
            </>
          ) : (
            'Sag „Wurf“ und die Punktzahl – oder tippe.'
          )}
          <span className="game-avg">Ø {fmtAvg(matchStats(state, cur).average)}</span>
        </p>
      </section>

      {state.players.length > 1 && (
        <ul className="game-others">
          {others.map(({ p, i }) => (
            <li key={config.players[i]!.id}>
              <span className="game-other-name">{config.players[i]!.name}</span>
              <span className="game-other-rest" data-testid={`rest-${i}`}>
                {p.remaining}
              </span>
              <span className="game-other-meta">
                {config.sets ? `${p.setsWon} S, ` : ''}
                {p.legsWon} L, Ø {fmtAvg(matchStats(state, i).average)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pad !== 'none' && (
        <section className="game-pad">
          {pad === 'numbers' ? (
            <NumberPad
              onSubmit={(n) => submitVisit(n, { source: 'touch' })}
              onBust={() => submitVisit(0, { bust: true, source: 'touch' })}
            />
          ) : (
            <BoardPad onSubmit={(d) => submitDarts(d, 'touch')} />
          )}
        </section>
      )}

      <nav className="game-bar" aria-label="Spielsteuerung">
        <button
          className="btn"
          aria-expanded={pad !== 'none'}
          onClick={() => setPad(pad === 'none' ? (boardPadDefault ? 'board' : 'numbers') : 'none')}
        >
          {pad === 'none' ? 'Tippen' : 'Pad zu'}
        </button>
        {pad !== 'none' && (
          <button className="btn" onClick={() => setPad(pad === 'numbers' ? 'board' : 'numbers')}>
            {pad === 'numbers' ? 'Einzeldarts' : 'Summe'}
          </button>
        )}
        <button className="btn" onClick={() => undo('touch')}>
          Zurück
        </button>
        <MicButton />
        <button className="btn btn-quiet" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          Menü
        </button>
      </nav>

      {menu && (
        <div className="sheet" role="dialog" aria-label="Menü">
          <button
            className="btn"
            onClick={() => {
              restartLeg();
              setMenu(false);
            }}
          >
            Leg neu starten
          </button>
          <button className="btn" onClick={() => navigate('stats')}>
            Statistik
          </button>
          <button className="btn" onClick={() => navigate('settings')}>
            Einstellungen
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              useMatch.getState().close();
              navigate('setup');
            }}
          >
            Spiel beenden
          </button>
          <button className="btn btn-quiet" onClick={() => setMenu(false)}>
            Schließen
          </button>
        </div>
      )}

      {needsBullOut && (
        <div className="sheet" role="dialog" aria-label="Bull-Out">
          <h2>Wer hat das Bull-Out gewonnen?</h2>
          {config.players.map((p, i) => (
            <button key={p.id} className="btn" onClick={() => setStarter(i)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {question && (
        <div className="sheet" role="dialog" aria-label="Nachfrage">
          <h2>{question === 'checkoutDarts' ? 'Mit wie vielen Darts?' : 'Darts auf Doppel?'}</h2>
          <div className="sheet-row">
            {(question === 'checkoutDarts' ? [1, 2, 3] : [0, 1, 2, 3]).map((n) => (
              <button key={n} className="btn pad-key" onClick={() => answerQuestion(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn btn-quiet" onClick={dismissQuestion}>
            Überspringen
          </button>
        </div>
      )}
    </div>
  );
}

function MatchOver({ state }: { state: MatchState }) {
  const { config } = state;
  const winner = config.players[state.winner!]!;
  return (
    <div className="screen match-over">
      <h1 className="match-over-title">{winner.name} gewinnt</h1>
      <p className="match-over-score">{scoreLine(state)}</p>
      <table className="stat-table">
        <thead>
          <tr>
            <th scope="col">Spieler</th>
            <th scope="col">Ø</th>
            <th scope="col">First 9</th>
            <th scope="col">Checkout</th>
            <th scope="col">Highfinish</th>
            <th scope="col">180</th>
          </tr>
        </thead>
        <tbody>
          {config.players.map((p, i) => {
            const s = matchStats(state, i);
            return (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                <td>{fmtAvg(s.average)}</td>
                <td>{fmtAvg(s.first9)}</td>
                <td>{s.checkoutRate === null ? '–' : `${Math.round(s.checkoutRate * 100)} %`}</td>
                <td>{s.highestFinish ?? '–'}</td>
                <td>{s.count180}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="match-over-actions">
        <button
          className="btn btn-primary"
          onClick={() => startMatch({ ...config, players: [...config.players.slice(1), config.players[0]!] })}
        >
          Revanche
        </button>
        <button
          className="btn"
          onClick={() => {
            useMatch.getState().close();
            navigate('setup');
          }}
        >
          Neues Spiel
        </button>
      </div>
    </div>
  );
}
