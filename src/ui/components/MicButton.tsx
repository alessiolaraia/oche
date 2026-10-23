import { setPaused, startVoice, stopVoice } from '../../voice/control';
import { useVoice } from '../../store/voice';

const LABEL = {
  off: 'Mikro an',
  loading: 'Lädt …',
  listening: 'Pause',
  hearing: 'Pause',
  paused: 'Weiter',
} as const;

export function MicButton() {
  const status = useVoice((s) => s.status);
  return (
    <>
      <button
        className={`btn${status === 'off' ? ' btn-primary' : ''}`}
        disabled={status === 'loading'}
        data-testid="mic-button"
        onClick={() => {
          if (status === 'off') void startVoice();
          else setPaused(status !== 'paused');
        }}
      >
        {LABEL[status]}
      </button>
      {status !== 'off' && (
        <button className="btn btn-quiet" onClick={stopVoice} aria-label="Mikro aus">
          Mikro aus
        </button>
      )}
    </>
  );
}
