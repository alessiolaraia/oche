import { useEffect, useState } from 'react';
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
import { stopTraining } from '../../app/training';
import { botVisit, skillFor } from '../../engine/bot';
import { checkoutRoute, dartLabel, formatRoute } from '../../engine/checkouts';
import { matchStats } from '../../engine/stats';
import type { MatchState } from '../../engine/types';
import { keepScreenOn } from '../../platform/wakeLock';
import { useMatch } from '../../store/match';
import { useSession } from '../../store/session';
import { useSettings } from '../../store/settings';
import { useTraining } from '../../store/training';
import { useVoice } from '../../store/voice';
import { capitalize } from '../components/controls';
import { BigNumber } from '../components/BigNumber';
import { BoardPad } from '../components/BoardPad';
import { Icon } from '../components/Icon';
import { MicAura, MicChip } from '../components/MicAura';
import { MicButton } from '../components/MicButton';
import { NumberPad } from '../components/NumberPad';
import { startVoice, stopVoice } from '../../voice/control';
import { navigate } from '../router';
import './game.css';
import './arena.css';
import './arena-neon.css';

function fmtAvg(n: number | null): string {
  return n === null ? '–' : n.toFixed(1).replace('.', ',');
}

function scoreLine(state: MatchState): string {
  const p = state.players;
  if (p.length !== 2) return `Leg ${state.legInSet}`;
  const legs = `Legs ${p[0]!.legsWon} : ${p[1]!.legsWon}`;
  return state.config.sets ? `Sets ${p[0]!.setsWon} : ${p[1]!.setsWon}   ${legs}` : legs;
}

export function Game() {
  const state = useMatch((s) => s.state);
  const events = useMatch((s) => s.events);
  const config = useMatch((s) => s.config);
  const kind = useMatch((s) => s.kind);
  const question = useSession((s) => s.question);
  const showRoute = useSettings((s) => s.display.showCheckoutRoute);
  const boardPadDefault = useSettings((s) => s.display.boardPad);
  const keepAwake = useSettings((s) => s.display.keepAwake);
  const arenaStyle = useSettings((s) => s.display.arena);
  const voiceEnabled = useSettings((s) => s.voice.enabled);
  const trigger = useSettings((s) => s.voice.trigger);
  const micStatus = useVoice((s) => s.status);
  const micError = useVoice((s) => s.error);
  const modelProgress = useVoice((s) => s.modelProgress);
  const training = useTraining();
  const [pad, setPad] = useState<'none' | 'numbers' | 'board'>('none');
  const [menu, setMenu] = useState(false);

  // Bot-Gegner wirft nach kurzer Pause selbst
  const botAvg = state && state.winner === null ? config?.players[state.current]?.bot?.average : undefined;
  const intro = useSession((s) => s.intro);
  const botBlocked = intro || question !== null || (config?.startOrder === 'bullOut' && events.length === 0);
  useEffect(() => {
    if (botAvg === undefined || botBlocked || !state) return;
    const t = setTimeout(() => {
      const p = state.players[state.current]!;
      submitDarts(botVisit(p.remaining, state.config.outMode, skillFor(botAvg), Math.random), 'touch');
    }, 2200);
    return () => clearTimeout(t);
  }, [botAvg, botBlocked, state]);

  // Bildschirm anlassen, solange ein Spiel läuft
  useEffect(() => {
    keepScreenOn(keepAwake && state !== null && state.winner === null);
    return () => keepScreenOn(false);
  }, [keepAwake, state]);

  if (!state || !config) {
    return (
      <div className="screen">
        <p className="hint">Kein Spiel aktiv.</p>
        <button className="btn btn-primary" onClick={() => navigate('setup')}>
          Spiel einrichten
        </button>
      </div>
    );
  }
  if (state.winner !== null && kind === 'x01') return <MatchOver state={state} />;

  const cur = state.current;
  const me = state.players[cur]!;
  const meCfg = config.players[cur]!;
  const myStats = matchStats(state, cur);
  const route = me.isIn ? checkoutRoute(me.remaining, config.outMode) : null;
  const needsBullOut = config.startOrder === 'bullOut' && events.length === 0;
  const last = state.lastVisit;
  const trainingDone = training.results.filter((r) => r.success).length;
  const myVisits = state.currentLeg.filter((v) => v.player === cur);
  const legDarts = myVisits.reduce((sum, v) => sum + v.darts, 0);
  const myLast = myVisits.at(-1);
  const legsTarget =
    config.legs.mode === 'firstTo' ? `First to ${config.legs.count}` : `Best of ${config.legs.count}`;

  return (
    <div className={`game arena${pad !== 'none' ? ' game-with-pad' : ''}`} data-arena={arenaStyle}>
      <header className="game-top">
        <button className="icon-btn" aria-label="Menü" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Icon name="menu" />
        </button>
        <MicChip />
        <button className="icon-btn" aria-label="Einstellungen" onClick={() => navigate('settings')}>
          <Icon name="settings" />
        </button>
      </header>

      <section className="game-focus" aria-label={`${meCfg.name}: Rest ${me.remaining}`}>
        <MicAura />
        <p className="game-meta">
          {kind === 'x01' ? (
            <>
              {scoreLine(state)} <span className="game-meta-dim">{legsTarget}</span>
            </>
          ) : (
            <span data-testid="training-status">
              {kind === '121' ? '121-Challenge' : 'Checkout-Training'}: Ziel {training.target}, geschafft{' '}
              {trainingDone} von {training.results.length}
            </span>
          )}
        </p>
        <h1 className="game-player" data-testid="active-player">
          {meCfg.name}
        </h1>
        <div className="game-number">
          <BigNumber value={me.remaining} label={`Rest ${me.remaining}`} />
        </div>
        <div className="game-stats">
          <div className="game-stat" title="3-Dart-Average in diesem Spiel">
            <span className="game-stat-value">{fmtAvg(myStats.average)}</span>
            <span className="game-stat-label">3-Dart Ø</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">{legDarts}</span>
            <span className="game-stat-label">Darts</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-value">{myLast ? (myLast.bust ? 'Bust' : myLast.scored) : '–'}</span>
            <span className="game-stat-label">Zuletzt</span>
          </div>
        </div>
        {showRoute && route && (
          <p className="game-route" data-testid="checkout-route" aria-label={formatRoute(route)}>
            {route.map((d, i) => (
              <span key={i} className="route-dart" data-m={d.segment === 25 ? 'bull' : d.multiplier}>
                {i > 0 && ' '}
                {dartLabel(d)}
              </span>
            ))}
          </p>
        )}
        {voiceEnabled && micStatus === 'off' && pad === 'none' && (
          <button
            className="btn btn-primary game-start-mic"
            onClick={() => void startVoice()}
            data-testid="start-voice"
          >
            <Icon name="mic" /> Sprachsteuerung starten
          </button>
        )}
        {(micError || modelProgress) && (
          <p className={`game-voice-note${micError ? ' warn' : ''}`} role="status">
            {micError ?? modelProgress}
          </p>
        )}
      </section>

      <section className="game-board card" aria-label="Spielstand">
        <div className="board-head" aria-hidden="true">
          <span>Spieler</span>
          {config.sets ? <span className="board-head-num">Sets</span> : null}
          <span className="board-head-num">Legs</span>
          <span className="board-head-rest">Rest</span>
        </div>
        <ol className="board" data-sets={config.sets ? 'true' : undefined}>
          {state.players.map((p, i) => {
            const st = i === cur ? myStats : matchStats(state, i);
            return (
              <li
                key={config.players[i]!.id}
                className="board-row"
                aria-current={i === cur ? 'true' : undefined}
              >
                <span className="board-name">{config.players[i]!.name}</span>
                <span className="board-stats">
                  <span>Ø {fmtAvg(st.average)}</span>
                  <span>{st.count180 > 0 ? `180 × ${st.count180}` : ''}</span>
                </span>
                {config.sets ? (
                  <span className="board-num" aria-label={`Sets ${p.setsWon}`}>
                    {p.setsWon}
                  </span>
                ) : null}
                <span className="board-num" aria-label={`Legs ${p.legsWon}`}>
                  {p.legsWon}
                </span>
                <span className="board-rest" data-testid={`rest-${i}`}>
                  {p.remaining}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="board-last">
          {last
            ? `Zuletzt: ${config.players[last.player]!.name} – ${last.bust ? 'Bust' : last.scored}`
            : `Sag „${capitalize(trigger)} sechzig“ – oder tippe.`}
        </p>
      </section>

      <section className="game-history card" aria-label="Verlauf dieses Legs">
        <h2 className="game-history-title">Dieses Leg</h2>
        {state.currentLeg.length === 0 ? (
          <p className="hint">Noch keine Aufnahme.</p>
        ) : (
          <ol className="history">
            {[...state.currentLeg]
              .reverse()
              .slice(0, 8)
              .map((v) => (
                <li key={v.eventId} className="history-row">
                  <span className="history-name">{config.players[v.player]!.name}</span>
                  <span className="history-score">{v.bust ? 'Bust' : v.scored}</span>
                  <span className="history-rest">{v.remainingAfter}</span>
                </li>
              ))}
          </ol>
        )}
      </section>

      {pad !== 'none' && (
        <section className="game-pad card">
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

      <nav className="game-bar card" aria-label="Spielsteuerung">
        {pad === 'none' ? (
          <button
            className="btn game-bar-pad"
            aria-expanded={false}
            onClick={() => setPad(boardPadDefault ? 'board' : 'numbers')}
          >
            <Icon name="keypad" />
            Tippen
          </button>
        ) : (
          <>
            <button
              className="icon-btn"
              aria-label="Pad zu"
              aria-expanded={true}
              onClick={() => setPad('none')}
            >
              <Icon name="close" />
            </button>
            <button className="btn btn-quiet" onClick={() => setPad(pad === 'numbers' ? 'board' : 'numbers')}>
              {pad === 'numbers' ? 'Einzeldarts' : 'Summe'}
            </button>
          </>
        )}
        <span className="game-bar-spacer" />
        <button className="icon-btn" aria-label="Zurück" onClick={() => undo('touch')}>
          <Icon name="undo" />
        </button>
        <MicButton />
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
          {micStatus !== 'off' && (
            <button
              className="btn"
              onClick={() => {
                stopVoice();
                setMenu(false);
              }}
            >
              Mikro aus
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              if (kind !== 'x01') {
                stopTraining();
                navigate('training');
                return;
              }
              useMatch.getState().close();
              navigate('setup');
            }}
          >
            {kind === 'x01' ? 'Spiel beenden' : 'Training beenden'}
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
  const arenaStyle = useSettings((s) => s.display.arena);
  const winner = config.players[state.winner!]!;
  return (
    <div className="screen match-over arena" data-arena={arenaStyle}>
      <div className="sg-aura match-over-aura" aria-hidden="true" />
      <p className="game-meta">{scoreLine(state)}</p>
      <h1 className="match-over-title">{winner.name} gewinnt</h1>
      <div className="card match-over-card">
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
      </div>
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
