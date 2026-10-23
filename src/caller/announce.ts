// Reine Funktion: Feedback-Ereignis → Ansage (Bausteine + Soundeffekt). Ohne Browser-APIs, daher testbar.
import type { FeedbackEvent } from '../app/feedback';
import { checkoutRoute } from '../engine/checkouts';
import type { MatchState } from '../engine/types';
import type { Settings } from '../settings/types';
import { cuesToText, phrasebook, type Cue, type Phrasebook } from './phrases';

export type Sfx = 'accept' | 'notUnderstood' | 'bust' | 'maximum' | 'ton' | 'highFinish' | 'leg' | 'match';

export interface Announcement {
  /** Bausteine in Reihenfolge – Clip aus dem Klang-Paket oder Systemstimme. */
  cues: Cue[];
  /** Ganzer Satz für die Systemstimme. */
  text: string;
  sfx: Sfx | null;
  /** Laufende Ansagen abbrechen (neue Aufnahme ist wichtiger als die alte Ansage). */
  interrupt: boolean;
}

const HIGH_FINISH = 100;

function turnText(pb: Phrasebook, c: Settings['caller'], st: MatchState): Cue[] {
  if (!c.announceTurn || st.winner !== null) return [];
  const p = st.players[st.current]!;
  const name = st.config.players[st.current]!.name;
  const parts: Cue[] = [];
  const route = p.isIn ? checkoutRoute(p.remaining, st.config.outMode) : null;
  if (st.players.length > 1) parts.push(...pb.yourTurn(name));
  if (route) {
    parts.push(...pb.require(p.remaining));
    if (c.announceCheckoutRoute) parts.push(...pb.route(route));
  }
  // Arena: „Max,“ allein klingt abgehackt → nur mit „you require …“
  if (pb.lang === 'en-GB' && !route) return [];
  return parts;
}

export function announce(
  e: FeedbackEvent,
  c: Settings['caller'],
  ctx: { state: MatchState | null; askingAny: boolean },
): Announcement | null {
  const pb = phrasebook(c.style);
  const special = c.specialCalls;
  const out = (parts: Cue[], sfx: Sfx | null, interrupt = false): Announcement | null => {
    const cues = c.enabled ? parts.filter((p) => p.text) : [];
    const text = cuesToText(cues);
    const s = c.sfx ? sfx : null;
    return text || s ? { cues, text, sfx: s, interrupt } : null;
  };

  switch (e.type) {
    case 'visit': {
      const r = e.result;
      const st = e.state;
      const name = st.config.players[r.player]!.name;
      if (r.bust) {
        return out(
          [...(c.announceScore ? pb.bust(r.remainingAfter) : []), ...turnText(pb, c, st)],
          'bust',
          true,
        );
      }
      if (r.checkout) {
        const high = special && r.scored >= HIGH_FINISH ? pb.highFinish(r.scored) : [];
        if (st.winner !== null) return out([...high, ...pb.matchShot(name)], special ? 'match' : 'leg', true);
        const parts = [...high, ...pb.legShot(name, r.legNumber)];
        // Nach der Nachfrage („Mit wie vielen Darts?“) kommt erst die Ansage, wer dran ist
        if (!ctx.askingAny) parts.push(...turnText(pb, c, st));
        return out(parts, special && r.scored >= HIGH_FINISH ? 'highFinish' : 'leg', true);
      }
      const parts: Cue[] = [];
      let sfx: Sfx | null = c.enabled ? null : 'accept';
      if (r.scored === 180 && special) {
        parts.push(...pb.maximum);
        sfx = 'maximum';
      } else {
        if (special && r.scored >= 100) sfx = 'ton';
        if (c.announceScore) parts.push(...pb.score(r.scored));
      }
      if (c.announceRemaining && pb.lang === 'de-DE') parts.push(...pb.remaining(r.remainingAfter));
      parts.push(...turnText(pb, c, st));
      return out(parts, sfx, true);
    }
    case 'corrected':
      return out(pb.corrected(e.result.scored, e.result.remainingAfter), 'accept', true);
    case 'undo': {
      const st = e.state;
      const p = st.players[st.current]!;
      return out(pb.undone(st.config.players[st.current]!.name, p.remaining), null, true);
    }
    case 'rejected':
      if (e.reason === 'impossible' || e.reason === 'notFinishable')
        return out(pb.impossible, 'notUnderstood', true);
      if (e.reason === 'notUnderstood' || e.reason === 'nothingToUndo') return out([], 'notUnderstood');
      return null;
    case 'remaining': {
      const st = e.state;
      const p = st.players[st.current]!;
      const route = p.isIn ? checkoutRoute(p.remaining, st.config.outMode) : null;
      return out([...pb.remaining(p.remaining), ...(route ? pb.route(route) : [])], null, true);
    }
    case 'question':
      return out(e.question === 'checkoutDarts' ? pb.askCheckoutDarts : pb.askDartsAtDouble, null);
    case 'answered': {
      const st = ctx.state;
      // nach der letzten Nachfrage: wer ist jetzt dran?
      return out([...pb.answered(e.value), ...(st && !ctx.askingAny ? turnText(pb, c, st) : [])], null, true);
    }
    case 'matchStarted': {
      const st = e.state;
      return out(pb.gameOn(st.config.players[st.current]!.name), null, true);
    }
    case 'legRestarted':
      return out(pb.newLeg, null, true);
    case 'control':
      return out(e.action === 'pause' ? pb.pause : e.action === 'resume' ? pb.resume : pb.micOff, null, true);
    case 'trainingTarget':
      return out(
        pb.target(
          e.label,
          e.mode === 'atc' ? (e.target <= 20 ? e.target : null) : e.target,
          e.mode === 'atc',
        ),
        null,
      );
    case 'trainingResult':
      return out(pb.trainingDone(e.success, e.darts), e.success ? 'leg' : 'bust', true);
  }
}
