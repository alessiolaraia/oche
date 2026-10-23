import { useSession } from '../store/session';
import { onFeedback, type RejectReason } from './feedback';

const REJECT_TEXT: Record<RejectReason, string | null> = {
  impossible: 'Nicht möglich',
  notFinishable: 'Nicht möglich',
  gameOver: 'Spiel vorbei',
  notUnderstood: '?',
  nothingToUndo: 'Nichts da',
  noQuestion: null,
};

/** Übersetzt Feedback-Ereignisse in Bildschirmblitze. */
export function installFlashFeedback(): () => void {
  return onFeedback((e) => {
    const { showFlash } = useSession.getState();
    switch (e.type) {
      case 'visit':
        if (e.result.bust) showFlash('reject', 'Bust');
        else if (e.result.checkout) showFlash('accept', e.state.winner !== null ? 'Match!' : 'Check!');
        else showFlash('accept', String(e.result.scored));
        break;
      case 'corrected':
        showFlash('accept', String(e.result.scored));
        break;
      case 'undo':
        showFlash('info', 'Zurück');
        break;
      case 'rejected': {
        const text = REJECT_TEXT[e.reason];
        if (text) showFlash('reject', text);
        break;
      }
      case 'remaining': {
        const p = e.state.players[e.state.current];
        if (p) showFlash('info', String(p.remaining));
        break;
      }
      case 'legRestarted':
        showFlash('info', 'Neues Leg');
        break;
      default:
        break;
    }
  });
}
