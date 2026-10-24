import { useEffect, useState } from 'react';
import { previewVoice } from '../../caller';
import { loadManifest, type PackManifest } from '../../caller/packPlayer';
import { listVoices, ttsSupported } from '../../caller/tts';
import { useSettings } from '../../store/settings';
import type { VoiceSource } from '../../settings/types';
import { Choice } from './controls';

/** Auswahl aller System-Stimmen (Deutsch und Englisch) + Probe hören. */
export function VoicePicker() {
  const caller = useSettings((s) => s.caller);
  const update = useSettings((s) => s.update);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
  const [pack, setPack] = useState<PackManifest | null | undefined>(undefined);
  const packLang = caller.style === 'arena' ? 'en' : 'de';

  useEffect(() => {
    let alive = true;
    void loadManifest(packLang).then((m) => alive && setPack(m));
    return () => {
      alive = false;
    };
  }, [packLang]);

  useEffect(() => {
    if (!ttsSupported()) return;
    const load = () => setVoices(listVoices());
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const source = (
    <Choice<VoiceSource>
      label="Stimme"
      hint={
        caller.voiceSource === 'system'
          ? 'Die eingebaute Stimme des Geräts.'
          : pack === null
            ? `Für diesen Stil ist noch kein Ansager-Paket installiert – bis dahin spricht die Systemstimme.`
            : `${pack?.name ?? 'Ansager-Paket'}: echte Aufnahmen, lauter bei hohen Zahlen. Namen spricht die Systemstimme.`
      }
      value={caller.voiceSource}
      options={{ pack: 'Oche-Ansager', system: 'Systemstimme' }}
      onChange={(v) => update('caller', { voiceSource: v })}
    />
  );

  if (!ttsSupported())
    return (
      <>
        {source}
        <p className="row warn">Dieser Browser hat keine Systemstimme – nur das Oche-Paket ist verfügbar.</p>
      </>
    );

  const de = voices.filter((v) => v.lang.startsWith('de'));
  const en = voices.filter((v) => v.lang.startsWith('en'));
  const label = (v: SpeechSynthesisVoice) => `${v.name} (${v.lang})${v.localService ? '' : ', online'}`;

  return (
    <>
      {source}
      <label className="row">
        <span className="label">
          Systemstimme Deutsch
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
          Systemstimme Englisch
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
