import { useVoice } from '../../store/voice';
import { setPaused, startVoice } from '../../voice/control';
import { Icon } from './Icon';

const LABEL = {
  off: 'Mikro an',
  loading: 'Mikro lädt',
  listening: 'Pause',
  hearing: 'Pause',
  paused: 'Weiter',
} as const;

/** Schwarzer Mikro-Knopf: an → Pause → weiter. Ausschalten im Menü. */
export function MicButton() {
  const status = useVoice((s) => s.status);
  const running = status === 'listening' || status === 'hearing';
  return (
    <button
      className="icon-btn icon-btn-dark mic-button"
      disabled={status === 'loading'}
      data-testid="mic-button"
      aria-label={LABEL[status]}
      title={LABEL[status]}
      onClick={() => {
        if (status === 'off') void startVoice();
        else setPaused(status !== 'paused');
      }}
    >
      <Icon name={running ? 'pause' : 'mic'} />
    </button>
  );
}
