import { useEffect, useState } from 'react';
import { previewVoice } from '../../caller';
import { listVoices, ttsSupported } from '../../caller/tts';
import { useSettings } from '../../store/settings';

/** Auswahl aller System-Stimmen (Deutsch und Englisch) + Probe hören. */
export function VoicePicker() {
  const caller = useSettings((s) => s.caller);
  const update = useSettings((s) => s.update);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());

  useEffect(() => {
    if (!ttsSupported()) return;
    const load = () => setVoices(listVoices());
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  if (!ttsSupported()) return <p className="row warn">Dieser Browser hat keine Sprachausgabe.</p>;

  const de = voices.filter((v) => v.lang.startsWith('de'));
  const en = voices.filter((v) => v.lang.startsWith('en'));
  const label = (v: SpeechSynthesisVoice) => `${v.name} (${v.lang})${v.localService ? '' : ', online'}`;

  return (
    <>
      <label className="row">
        <span className="label">
          Stimme Deutsch
          <small>Für den Stil „Nüchtern“.</small>
        </span>
        <select
          value={caller.voiceURI ?? ''}
          onChange={(e) => update('caller', { voiceURI: e.target.value || null })}
        >
          <option value="">Automatisch</option>
          {de.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {label(v)}
            </option>
          ))}
        </select>
      </label>
      <label className="row">
        <span className="label">
          Stimme Englisch
          <small>Für den Stil „Arena“.</small>
        </span>
        <select
          value={caller.voiceURIEn ?? ''}
          onChange={(e) => update('caller', { voiceURIEn: e.target.value || null })}
        >
          <option value="">Automatisch</option>
          {en.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {label(v)}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <span className="label">Probe</span>
        <button className="btn" onClick={previewVoice}>
          Probe hören
        </button>
      </div>
    </>
  );
}
