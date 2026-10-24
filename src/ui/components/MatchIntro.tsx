import { useEffect, useRef, useState } from 'react';
import { announceMatchStart } from '../../app/controller';
import { emitFeedback } from '../../app/feedback';
import { useMatch } from '../../store/match';
import { useSession } from '../../store/session';
import './match-intro.css';

// Intro vor jedem Spiel: Kamera fährt auf die Triple 20, drei Pfeile schlagen ein (60 → 120 → 180),
// „180“ knallt rein, dann „Name vs Name“ – und die Szene löst sich ins Spielbild auf. Tippen überspringt.

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const T20_R = 103;

/** Zeitplan in ms. */
const AT = { dart1: 560, dart2: 1060, dart3: 1560, names: 2650, out: 4500, done: 5050 } as const;

type Phase = 'darts' | 'max' | 'names' | 'out';

function arc(r1: number, r2: number, a1: number, a2: number): string {
  const p = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
}

function Board() {
  return (
    <g className="intro-board-face">
      <circle r="212" fill="#111" />
      <circle r="212" fill="url(#intro-rim)" />
      {ORDER.map((n, i) => {
        const a1 = i * 18 - 9;
        const a2 = a1 + 18;
        const dark = i % 2 === 0;
        const single = dark ? '#1c1a19' : '#ecdfc2';
        const ring = dark ? '#d3302e' : '#17864a';
        return (
          <g key={n}>
            <path d={arc(15.9, 99, a1, a2)} fill={single} />
            <path d={arc(99, 107, a1, a2)} fill={ring} />
            <path d={arc(107, 162, a1, a2)} fill={single} />
            <path d={arc(162, 170, a1, a2)} fill={ring} />
          </g>
        );
      })}
      {/* Drahtspinne */}
      <g fill="none" stroke="#c9c6c0" strokeOpacity="0.55" strokeWidth="0.7">
        {[15.9, 99, 107, 162, 170].map((r) => (
          <circle key={r} r={r} />
        ))}
        {ORDER.map((_, i) => {
          const rad = ((i * 18 - 9 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={15.9 * Math.cos(rad)}
              y1={15.9 * Math.sin(rad)}
              x2={170 * Math.cos(rad)}
              y2={170 * Math.sin(rad)}
            />
          );
        })}
      </g>
      <circle r="15.9" fill="#17864a" />
      <circle r="6.35" fill="#d3302e" />
      {ORDER.map((n, i) => {
        const rad = ((i * 18 - 90) * Math.PI) / 180;
        return (
          <text key={n} x={190 * Math.cos(rad)} y={190 * Math.sin(rad)} className="intro-board-num">
            {n}
          </text>
        );
      })}
    </g>
  );
}

/** Pfeil, Spitze im Ursprung, Körper schräg nach rechts unten (zum Werfer hin). */
function Dart() {
  return (
    <g transform="rotate(58)">
      <path d="M0 0 L9 -0.9 L9 0.9 Z" fill="url(#intro-steel)" />
      <rect x="9" y="-3.1" width="22" height="6.2" rx="2.4" fill="url(#intro-barrel)" />
      <g stroke="#000" strokeOpacity="0.35" strokeWidth="0.6">
        {[13, 15.5, 18, 20.5, 23, 25.5].map((x) => (
          <line key={x} x1={x} y1="-3" x2={x} y2="3" />
        ))}
      </g>
      <rect x="31" y="-1.5" width="18" height="3" rx="1" fill="#141414" />
      <path d="M44 0 L58 -11 L74 -12 L66 0 Z" fill="url(#intro-flight)" />
      <path d="M44 0 L58 11 L74 12 L66 0 Z" fill="url(#intro-flight)" opacity="0.8" />
      <path d="M44 -0.6 L74 -0.6 L74 0.6 L44 0.6 Z" fill="#fff" opacity="0.5" />
    </g>
  );
}

const HITS = [
  { x: -8, y: -T20_R - 1 },
  { x: 2, y: -T20_R + 1.5 },
  { x: 10, y: -T20_R - 0.5 },
];

export function MatchIntro() {
  const players = useMatch((s) => s.config?.players);
  const names = players?.map((p) => p.name) ?? [];
  const setIntro = useSession((s) => s.setIntro);
  const [phase, setPhase] = useState<Phase>('darts');
  const [darts, setDarts] = useState(0);
  const announced = useRef(false);

  useEffect(() => {
    const announce = () => {
      if (announced.current) return;
      announced.current = true;
      announceMatchStart();
    };
    const t = [
      ...([1, 2, 3] as const).map((n) =>
        setTimeout(() => {
          setDarts(n);
          if (n === 3) setPhase('max');
          emitFeedback({ type: 'introDart', n });
        }, AT[`dart${n}`]),
      ),
      setTimeout(() => {
        setPhase('names');
        announce();
      }, AT.names),
      setTimeout(() => setPhase('out'), AT.out),
      setTimeout(() => setIntro(false), AT.done),
    ];
    return () => {
      t.forEach(clearTimeout);
      // Übersprungen oder Bildschirm verlassen: Ansage trotzdem einmal
      announce();
    };
  }, [setIntro]);

  const score = darts * 60;
  return (
    <div
      className="intro"
      data-phase={phase}
      role="dialog"
      aria-label={names.join(' gegen ')}
      onPointerDown={() => setIntro(false)}
      data-testid="match-intro"
    >
      <div className="intro-aura intro-aura-a" aria-hidden="true" />
      <div className="intro-aura intro-aura-b" aria-hidden="true" />

      <div className="intro-stage" aria-hidden="true">
        <svg viewBox="-220 -220 440 440" className="intro-svg">
          <defs>
            <radialGradient id="intro-rim" r="0.5">
              <stop offset="0.9" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.7" />
            </radialGradient>
            <linearGradient id="intro-steel" x1="0" x2="1">
              <stop offset="0" stopColor="#8d8d8d" />
              <stop offset="1" stopColor="#f2f2f2" />
            </linearGradient>
            <linearGradient id="intro-barrel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4f4f4" />
              <stop offset="0.45" stopColor="#9a9a9a" />
              <stop offset="1" stopColor="#3b3b3b" />
            </linearGradient>
            <linearGradient id="intro-flight" x1="0" x2="1">
              <stop offset="0" stopColor="#3d7bff" />
              <stop offset="0.5" stopColor="#9b4dff" />
              <stop offset="1" stopColor="#ff3d9a" />
            </linearGradient>
          </defs>
          <g className="intro-cam">
            <Board />
            {HITS.map((h, i) => (
              <g key={i} transform={`translate(${h.x} ${h.y})`}>
                <circle
                  className="intro-hit"
                  r="6"
                  style={{ animationDelay: `${AT[`dart${(i + 1) as 1 | 2 | 3}`]}ms` }}
                />
                <g
                  className="intro-dart"
                  style={{ animationDelay: `${AT[`dart${(i + 1) as 1 | 2 | 3}`] - 380}ms` }}
                >
                  <Dart />
                </g>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="intro-hud" aria-hidden="true">
        {score > 0 && phase === 'darts' && (
          <span key={score} className="intro-count">
            {score}
          </span>
        )}
        {(phase === 'max' || phase === 'names' || phase === 'out') && (
          <span className="intro-max">
            <span className="intro-shock" />
            180
          </span>
        )}
      </div>

      {(phase === 'names' || phase === 'out') && names.length > 0 && (
        <div className="intro-names">
          {names.map((n, i) => (
            <span key={i} className="intro-name-wrap">
              {i > 0 && <span className="intro-vs">vs</span>}
              <span className="intro-name" style={{ animationDelay: `${i * 120}ms` }}>
                {n}
              </span>
            </span>
          ))}
        </div>
      )}
      <span className="intro-skip">Tippen zum Überspringen</span>
    </div>
  );
}
