import { useEffect, useMemo, useRef, useState } from 'react';
import { db, type StoredMatch } from '../../db/db';
import { buildExport, importMatches, parseExport } from '../../db/exportImport';
import { statsFromLegs, type PlayerStats } from '../../engine/stats';
import type { LegRecord } from '../../engine/types';
import { reduce } from '../../engine/x01';
import { pickSettings, useSettings } from '../../store/settings';
import { LineChart, type Point } from '../components/LineChart';
import './stats.css';

interface PlayerMatch {
  match: StoredMatch;
  index: number;
  stats: PlayerStats;
  won: boolean;
}

function fmt(n: number | null, digits = 1): string {
  return n === null ? '–' : n.toFixed(digits).replace('.', ',');
}

export function Stats() {
  const [matches, setMatches] = useState<StoredMatch[] | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => void db.matches.orderBy('startedAt').toArray().then(setMatches);
  useEffect(load, []);

  const x01 = useMemo(() => (matches ?? []).filter((m) => m.kind === 'x01'), [matches]);
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const m of x01) for (const p of m.config.players) if (!p.bot) set.add(p.name);
    return [...set];
  }, [x01]);
  const selected = player ?? names[0] ?? null;

  const perMatch: PlayerMatch[] = useMemo(() => {
    if (!selected) return [];
    return x01.flatMap((m) => {
      const index = m.config.players.findIndex((p) => p.name === selected);
      if (index < 0) return [];
      const state = reduce(m.config, m.events);
      return [
        {
          match: m,
          index,
          stats: statsFromLegs(state.legs, index, state.currentLeg),
          won: m.winner === index,
        },
      ];
    });
  }, [x01, selected]);

  const total = useMemo(() => {
    if (!selected) return null;
    const legs: LegRecord[] = [];
    for (const { match, index } of perMatch) {
      const st = reduce(match.config, match.events);
      // Spielerindex auf 0 normalisieren, damit Legs verschiedener Matches zusammenpassen
      for (const leg of [
        ...st.legs,
        { visits: st.currentLeg, winner: -1, legNumber: 0, setNumber: 0, starter: 0 },
      ]) {
        legs.push({
          ...leg,
          winner: leg.winner === index ? 0 : -1,
          visits: leg.visits.filter((v) => v.player === index).map((v) => ({ ...v, player: 0 })),
        });
      }
    }
    return statsFromLegs(legs, 0);
  }, [perMatch, selected]);

  const points: Point[] = perMatch
    .filter((m) => m.stats.average !== null)
    .map((m) => ({
      x: m.match.startedAt,
      y: m.stats.average!,
      label: `${new Date(m.match.startedAt).toLocaleDateString('de-DE')}: Ø ${fmt(m.stats.average)}`,
    }));

  const doExport = async () => {
    const data = await buildExport(pickSettings(useSettings.getState()));
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oche-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      const parsed = parseExport(await file.text());
      const n = await importMatches(parsed);
      if (confirm('Auch die Einstellungen aus der Datei übernehmen?'))
        useSettings.getState().replace(parsed.settings);
      setMessage(`${n} Spiele importiert.`);
      load();
    } catch (e) {
      setMessage(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="screen stats">
      <header className="screen-head">
        <h1>Statistik</h1>
        <a
          className="link-back"
          href="#/"
          onClick={(e) => history.length > 1 && (e.preventDefault(), history.back())}
        >
          Zurück
        </a>
      </header>

      {matches === null ? (
        <p>Lade …</p>
      ) : names.length === 0 ? (
        <p>
          Noch keine Spiele. Nach dem ersten Match steht hier dein Average, deine Checkout-Quote und der
          Verlauf.
        </p>
      ) : (
        <>
          <div className="segmented stats-players" role="group" aria-label="Spieler">
            {names.map((n) => (
              <button key={n} aria-pressed={n === selected} onClick={() => setPlayer(n)}>
                {n}
              </button>
            ))}
          </div>

          {total && (
            <dl className="stats-kpis">
              <Kpi label="3-Dart-Average" value={fmt(total.average)} />
              <Kpi label="First 9" value={fmt(total.first9)} />
              <Kpi
                label="Checkout-Quote"
                value={total.checkoutRate === null ? '–' : `${Math.round(total.checkoutRate * 100)} %`}
                note={`${total.checkouts} von ${total.checkoutAttempts}`}
              />
              <Kpi label="Höchstes Finish" value={String(total.highestFinish ?? '–')} />
              <Kpi label="180er" value={String(total.count180)} />
              <Kpi label="140+" value={String(total.count140)} />
              <Kpi label="100+" value={String(total.count100)} />
              <Kpi label="Bestes Leg" value={total.bestLeg ? `${total.bestLeg} Darts` : '–'} />
              <Kpi label="Darts pro Leg" value={fmt(total.avgDartsPerWonLeg)} />
            </dl>
          )}

          <h2 className="section-title">Average pro Spiel</h2>
          {points.length >= 2 ? (
            <LineChart points={points} yLabel="3-Dart-Average" />
          ) : (
            <p className="hint">Ab zwei Spielen siehst du hier den Verlauf.</p>
          )}

          <h2 className="section-title">Spiele</h2>
          <table className="stat-table">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Gegner</th>
                <th scope="col">Ø</th>
                <th scope="col">Checkout</th>
                <th scope="col">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {[...perMatch].reverse().map(({ match, index, stats, won }) => (
                <tr key={match.id}>
                  <th scope="row">{new Date(match.startedAt).toLocaleDateString('de-DE')}</th>
                  <td>
                    {match.config.players
                      .filter((_, i) => i !== index)
                      .map((p) => p.name)
                      .join(', ') || 'Solo'}
                  </td>
                  <td>{fmt(stats.average)}</td>
                  <td>{stats.checkoutRate === null ? '–' : `${Math.round(stats.checkoutRate * 100)} %`}</td>
                  <td>{match.finishedAt ? (won ? 'Sieg' : 'Niederlage') : 'offen'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="section-title">Daten übertragen</h2>
      <p className="hint">
        Exportiere alles als JSON-Datei und importiere sie auf dem anderen Gerät (z. B. per AirDrop oder
        Mail).
      </p>
      <div className="stats-io">
        <button className="btn" onClick={() => void doExport()}>
          Exportieren
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importieren
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stats-kpi">
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <small>{note}</small>}
      </dd>
    </div>
  );
}
