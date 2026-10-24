import { useEffect, useRef, useState } from 'react';
import { announceMatchStart } from '../../app/controller';
import { emitFeedback } from '../../app/feedback';
import type { MatchConfig } from '../../engine/types';
import { useMatch } from '../../store/match';
import { useSession } from '../../store/session';
import type { IntroEvent } from '../intro/scene';
import './match-intro.css';

// Intro vor jedem Spiel: 3D-Szene (Three.js, nachgeladen) mit drei Würfen in die Triple 20,
// darüber Kino-Einblendungen: Balken, Zwischenstand, „180“, dann „Name vs Name“. Tippen überspringt.

type Phase = 'darts' | 'max' | 'names' | 'out';

function formatLine(config: MatchConfig | null): string {
  if (!config) return '';
  const out =
    config.outMode === 'double' ? 'Double-Out' : config.outMode === 'master' ? 'Master-Out' : 'Straight-Out';
  const legs = `${config.legs.mode === 'firstTo' ? 'First to' : 'Best of'} ${config.legs.count}`;
  return `${config.startScore} · ${out} · ${legs}`;
}

export function MatchIntro() {
  const config = useMatch((s) => s.config);
  const setIntro = useSession((s) => s.setIntro);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('darts');
  const [hits, setHits] = useState(0);
  const announced = useRef(false);
  const names = config?.players.map((p) => p.name) ?? [];

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | null = null;
    const announce = () => {
      if (announced.current) return;
      announced.current = true;
      announceMatchStart();
    };
    const on = (e: IntroEvent) => {
      switch (e.type) {
        case 'throw':
          emitFeedback({ type: 'introThrow', n: e.n });
          break;
        case 'hit':
          setHits(e.n);
          emitFeedback({ type: 'introDart', n: e.n });
          break;
        case 'maximum':
          setPhase('max');
          emitFeedback({ type: 'introMaximum' });
          break;
        case 'names':
          setPhase('names');
          announce();
          break;
        case 'out':
          setPhase('out');
          break;
        case 'done':
          setIntro(false);
          break;
      }
    };
    import('../intro/scene')
      .then(({ createIntroScene }) => {
        if (disposed || !canvas.current) return;
        dispose = createIntroScene(canvas.current, on).dispose;
      })
      // Kein WebGL o. Ä.: Intro auslassen
      .catch((err: unknown) => {
        console.warn('[intro] 3D nicht verfügbar, übersprungen:', err);
        setIntro(false);
      });
    return () => {
      disposed = true;
      dispose?.();
      // Übersprungen oder Bildschirm verlassen: Ansage trotzdem einmal
      announce();
    };
  }, [setIntro]);

  const total = hits * 60;
  return (
    <div
      className="intro"
      data-phase={phase}
      role="dialog"
      aria-label={names.join(' gegen ')}
      onPointerDown={() => setIntro(false)}
      data-testid="match-intro"
    >
      <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />
      <div className="intro-vignette" aria-hidden="true" />
      <div className="intro-bar intro-bar-top" aria-hidden="true" />
      <div className="intro-bar intro-bar-bottom" aria-hidden="true" />

      {phase === 'darts' && hits > 0 && (
        <div className="intro-lower" aria-hidden="true">
          <div className="intro-lower-darts">
            {[1, 2, 3].map((n) => (
              <span key={n} className="intro-chip" data-on={n <= hits}>
                T20
              </span>
            ))}
          </div>
          <span key={total} className="intro-total">
            {total}
          </span>
        </div>
      )}

      {phase === 'max' && <div className="intro-flash" aria-hidden="true" />}
      {phase !== 'darts' && (
        <div className="intro-max-wrap" aria-hidden="true">
          <span className="intro-shock" />
          <span className="intro-max">180</span>
          <span className="intro-max-label">Maximum</span>
        </div>
      )}

      {(phase === 'names' || phase === 'out') && names.length > 0 && (
        <div className="intro-names" data-count={names.length}>
          <span className="intro-streak" aria-hidden="true" />
          {names.map((n, i) => (
            <div key={i} className="intro-name-row" style={{ ['--i' as string]: i }}>
              {i > 0 && (
                <span className="intro-vs" aria-hidden="true">
                  <span className="intro-vs-ring" />
                  <span className="intro-vs-text">VS</span>
                </span>
              )}
              <span className="intro-name" data-side={i % 2 === 0 ? 'a' : 'b'}>
                {n}
              </span>
            </div>
          ))}
          <span className="intro-format">{formatLine(config)}</span>
        </div>
      )}
      <span className="intro-skip">Tippen zum Überspringen</span>
    </div>
  );
}
