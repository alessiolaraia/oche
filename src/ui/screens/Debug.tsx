import { useEffect, useState } from 'react';
import { refreshStorageEstimate } from '../../platform/storage';
import { usePlatform } from '../../store/platform';
import { useSettings } from '../../store/settings';
import { useVoice } from '../../store/voice';
import { startVoice, stopVoice, voskSupported } from '../../voice/control';
import { webSpeechSupported } from '../../voice/webSpeechEngine';
import { LevelMeter } from '../components/LevelMeter';
import { PackTester } from '../components/PackTester';
import { VoiceLog } from '../components/VoiceLog';

const ENGINE_LABEL = {
  vosk: 'Vosk (offline, Grammatik)',
  webspeech: 'Web Speech API (Browser)',
  none: 'keine',
};

function mb(n: number | null) {
  return n === null ? '–' : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function useFeatures() {
  const [sw, setSw] = useState(() => ('serviceWorker' in navigator ? 'prüfe …' : 'nicht unterstützt'));
  const [voices, setVoices] = useState(() =>
    'speechSynthesis' in window ? speechSynthesis.getVoices().length : 0,
  );
  const [idb, setIdb] = useState<string>('–');
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration()
        .then((r) => setSw(r?.active ? 'aktiv' : 'nicht registriert'));
    const load = () => setVoices(speechSynthesis.getVoices().length);
    if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', load);
    void indexedDB.databases?.().then((dbs) =>
      setIdb(
        dbs
          .map((d) => d.name)
          .filter(Boolean)
          .join(', ') || 'keine',
      ),
    );
    void refreshStorageEstimate();
    return () => {
      if ('speechSynthesis' in window) speechSynthesis.removeEventListener('voiceschanged', load);
    };
  }, []);
  return { sw, voices, idb };
}

export function Debug() {
  const v = useVoice();
  const p = usePlatform();
  const gateDb = useSettings((s) => s.voice.gateDb);
  const f = useFeatures();

  const rows: [string, string][] = [
    ['Aktive Engine', ENGINE_LABEL[v.engine]],
    ['Status', v.status],
    ['Sample-Rate (Gerät)', v.sampleRate ? `${v.sampleRate} Hz → 16000 Hz` : '–'],
    ['Pegel', `${Math.round(v.inputDb)} dBFS, Gate ${v.gateOpen ? 'offen' : 'zu'}`],
    ['Wake Lock', p.wakeLock],
    ['Audio-Session (iOS)', p.audioSession],
    ['Speicher dauerhaft', p.persisted === null ? '–' : p.persisted ? 'ja' : 'nein'],
    ['Speicher belegt', `${mb(p.storageUsage)} von ${mb(p.storageQuota)}`],
    ['IndexedDB', f.idb],
    ['Service Worker', f.sw],
    ['Vosk möglich (WASM, Worker, AudioWorklet)', voskSupported() ? 'ja' : 'nein'],
    ['Web Speech API', webSpeechSupported() ? 'ja' : 'nein'],
    ['Sprachausgabe-Stimmen', String(f.voices)],
    ['Wake-Lock-API', 'wakeLock' in navigator ? 'ja' : 'nein'],
    ['Online', navigator.onLine ? 'ja' : 'nein (offline)'],
  ];

  return (
    <div className="screen debug">
      <header className="screen-head">
        <h1>Diagnose</h1>
        <a className="link-back" href="#/settings">
          Zurück
        </a>
      </header>
      <div className="debug-actions">
        {v.status === 'off' ? (
          <button className="btn btn-primary" onClick={() => void startVoice()}>
            Mikro starten
          </button>
        ) : (
          <button className="btn" onClick={stopVoice}>
            Mikro stoppen
          </button>
        )}
        <label className="mic-testmode">
          <input
            type="checkbox"
            checked={v.testMode}
            onChange={(e) => v.set({ testMode: e.target.checked })}
          />
          Testmodus
        </label>
      </div>
      {v.modelProgress && <p>{v.modelProgress}</p>}
      {v.error && <p className="warn">{v.error}</p>}
      {v.warnings.map((w) => (
        <p key={w} className="warn">
          {w}
        </p>
      ))}
      <LevelMeter gateDb={gateDb} />
      <table className="stat-table debug-table">
        <tbody>
          {rows.map(([k, val]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="section-title">Klang-Paket</h2>
      <PackTester />
      <h2 className="section-title">Letzte 20 Rohergebnisse</h2>
      <VoiceLog limit={20} />
      <p className="hint">{navigator.userAgent}</p>
    </div>
  );
}
