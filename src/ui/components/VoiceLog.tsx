import { useVoice } from '../../store/voice';

/** Letzte Rohergebnisse der Erkennung mit Konfidenz. */
export function VoiceLog({ limit = 20 }: { limit?: number }) {
  const results = useVoice((s) => s.results);
  const partial = useVoice((s) => s.partial);
  return (
    <div className="voice-log">
      <p className="voice-log-partial" aria-live="polite">
        {partial ? `… ${partial}` : ' '}
      </p>
      <ol className="voice-log-list">
        {results.slice(0, limit).map((r) => (
          <li key={r.at + r.text} data-accepted={r.accepted}>
            <span className="voice-log-text">{r.text}</span>
            <span className="voice-log-meta">
              {r.confidence === null ? '–' : `${Math.round(r.confidence * 100)} %`}
              {r.note ? `, ${r.note}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
