import { useEffect, useState } from 'react';
import { startTraining, stopTraining } from '../../app/training';
import { submitVisit, undo } from '../../app/controller';
import { db, type TrainingResult } from '../../db/db';
import { ATC_DONE, atcLabel, type TrainingMode } from '../../engine/training';
import { useSettings } from '../../store/settings';
import { useTraining } from '../../store/training';
import { useVoice } from '../../store/voice';
import { startVoice } from '../../voice/control';
import { BigNumber } from '../components/BigNumber';
import { capitalize } from '../components/controls';
import { MicButton } from '../components/MicButton';
import { navigate } from '../router';
import { Icon } from '../components/Icon';
import './training.css';

const MODES: { mode: TrainingMode; title: string; text: string }[] = [
  {
    mode: 'atc',
    title: 'Around the Clock',
    text: 'Von 1 bis 20, dann Bull. Sag pro Aufnahme die Treffer: „Wurf zwei“.',
  },
  {
    mode: 'checkout',
    title: 'Checkout-Training',
    text: 'Zufällige Reste von 2 bis 170, drei Darts pro Rest.',
  },
  {
    mode: '121',
    title: '121-Challenge',
    text: 'Neun Darts für 121. Geschafft: eins höher. Sonst nochmal.',
  },
];

function useHistory(mode: TrainingMode | null) {
  const [rows, setRows] = useState<TrainingResult[]>([]);
  useEffect(() => {
    let alive = true;
    void db.trainings
      .orderBy('at')
      .reverse()
      .limit(300)
      .toArray()
      .then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [mode]);
  return rows;
}

function summary(rows: TrainingResult[], mode: TrainingMode): string {
  const r = rows.filter((x) => x.mode === mode);
  if (r.length === 0) return 'Noch nicht gespielt.';
  if (mode === 'atc')
    return `Bestes Ergebnis: ${Math.min(...r.map((x) => x.darts))} Darts (${r.length}× gespielt).`;
  const ok = r.filter((x) => x.success).length;
  const best =
    mode === '121'
      ? `, höchstes geschafftes Ziel ${Math.max(0, ...r.filter((x) => x.success).map((x) => x.target))}`
      : '';
  return `${Math.round((ok / r.length) * 100)} % geschafft (${ok} von ${r.length})${best}.`;
}

export function Training() {
  const mode = useTraining((s) => s.mode);
  const history = useHistory(mode);
  const voiceEnabled = useSettings((s) => s.voice.enabled);

  if (mode === 'atc') return <AroundTheClock />;

  return (
    <div className="screen training">
      <header className="screen-head">
        <a className="icon-btn" href="#/" aria-label="Zurück">
          <Icon name="back" />
        </a>
        <h1>Training</h1>
      </header>
      <ul className="card training-modes">
        {MODES.map((m) => (
          <li key={m.mode} className="row">
            <div className="label">
              <h2>{m.title}</h2>
              <small>{m.text}</small>
              <small>{summary(history, m.mode)}</small>
            </div>
            <button
              className="btn btn-primary"
              data-testid={`training-${m.mode}`}
              onClick={() => {
                startTraining(m.mode);
                if (voiceEnabled) void startVoice();
                if (m.mode !== 'atc') navigate('game');
              }}
            >
              Starten
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AroundTheClock() {
  const atc = useTraining((s) => s.atc);
  const trigger = useSettings((s) => s.voice.trigger);
  const micStatus = useVoice((s) => s.status);
  const done = atc.target >= ATC_DONE;

  return (
    <div className="atc">
      <header className="atc-head">
        <h1 className="sg-head">Around the Clock</h1>
        <span className="chip" data-testid="atc-darts">
          {atc.darts} Darts
        </span>
      </header>
      <section className="atc-target" aria-label={`Ziel ${atcLabel(atc.target)}`}>
        <div className="sg-aura atc-aura" aria-hidden="true" />
        {done ? (
          <p className="atc-done">Geschafft mit {atc.darts} Darts</p>
        ) : atc.target <= 20 ? (
          <BigNumber value={atc.target} label={`Ziel ${atc.target}`} />
        ) : (
          <p className="atc-bull">Bull</p>
        )}
      </section>
      <p className="hint atc-hint">
        Treffer pro Aufnahme sagen: „{capitalize(trigger)} zwei“ – oder tippen.
        {micStatus === 'off' && ' Mikro ist aus.'}
      </p>
      {!done && (
        <div className="atc-hits" role="group" aria-label="Treffer in dieser Aufnahme">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} className="pad-key" onClick={() => submitVisit(n, { source: 'touch' })}>
              {n}
            </button>
          ))}
        </div>
      )}
      <nav className="game-bar card">
        <button className="btn" onClick={() => undo('touch')}>
          Zurück
        </button>
        <MicButton />
        <button
          className="btn btn-quiet"
          onClick={() => {
            stopTraining();
            navigate('training');
          }}
        >
          Beenden
        </button>
      </nav>
    </div>
  );
}
