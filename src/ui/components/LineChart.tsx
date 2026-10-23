import { useState } from 'react';

export interface Point {
  x: number;
  y: number;
  label: string;
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step = [1, 2, 5, 10, 20, 25, 50].map((s) => s).find((s) => span / s <= count) ?? 100;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step / 2; v += step) ticks.push(v);
  return ticks;
}

/** Einfache Linie mit Markern, Fadenkreuz-Tooltip und Tabellenansicht (eine Serie, keine Legende). */
export function LineChart({ points, yLabel }: { points: Point[]; yLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ys = points.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0]!;
  const yMax = ticks.at(-1)!;
  const sx = (i: number) => PAD.left + (i / Math.max(1, points.length - 1)) * (W - PAD.left - PAD.right);
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const h = hover === null ? null : points[hover]!;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${yLabel} über ${points.length} Spiele`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((x - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text
              x={PAD.left - 8}
              y={sy(t)}
              className="chart-axis"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {t}
            </text>
          </g>
        ))}
        <path d={path} className="chart-line" />
        {points.map((p, i) => (
          <circle key={i} cx={sx(i)} cy={sy(p.y)} r={hover === i ? 6 : 4} className="chart-dot" />
        ))}
        {h && hover !== null && (
          <line x1={sx(hover)} x2={sx(hover)} y1={PAD.top} y2={H - PAD.bottom} className="chart-cross" />
        )}
      </svg>
      <figcaption className="chart-tip" aria-live="polite">
        {h ? h.label : `Fahre über die Linie für Details. Letztes Spiel: ${points.at(-1)!.label}`}
      </figcaption>
      <details className="chart-table">
        <summary>Als Tabelle</summary>
        <table className="stat-table">
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
