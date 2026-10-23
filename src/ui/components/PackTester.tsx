import { useState } from 'react';
import { loadManifest, playClip, type PackManifest } from '../../caller/packPlayer';
import { unlockSfx } from '../../caller/sfx';
import { K, type PackLang } from '../../caller/voicepack';
import { useSettings } from '../../store/settings';

const SAMPLES = [
  K.score(26),
  K.score(60),
  K.score(100),
  K.score(140),
  K.score(180),
  K.bust,
  K.highFinish,
  K.matchWon,
];

/** Klang-Paket anhören: Beispiele mit steigender Intensität oder ein beliebiger Clip-Schlüssel. */
export function PackTester() {
  const volume = useSettings((s) => s.caller.volume);
  const [lang, setLang] = useState<PackLang>('de');
  const [key, setKey] = useState('score_141');
  const [info, setInfo] = useState<string | null>(null);

  const withManifest = async (fn: (m: PackManifest) => Promise<void>) => {
    unlockSfx();
    const m = await loadManifest(lang);
    if (!m) {
      setInfo('Paket nicht gefunden.');
      return;
    }
    setInfo(`${m.name}: ${Object.keys(m.clips).length} Clips`);
    await fn(m);
  };

  return (
    <div className="pack-tester">
      <div className="segmented">
        {(['de', 'en'] as const).map((l) => (
          <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l === 'de' ? 'Deutsch' : 'Englisch'}
          </button>
        ))}
      </div>
      <button
        className="btn"
        onClick={() =>
          void withManifest(async (m) => {
            for (const k of SAMPLES) await playClip(lang, m, k, volume);
          })
        }
      >
        Steigerung anhören
      </button>
      <label className="pack-tester-key">
        Clip
        <input type="text" value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="none" />
      </label>
      <button
        className="btn"
        onClick={() =>
          void withManifest(async (m) => {
            if (!(await playClip(lang, m, key.trim(), volume))) setInfo(`„${key}“ gibt es nicht im Paket.`);
          })
        }
      >
        Abspielen
      </button>
      {info && <p className="hint">{info}</p>}
    </div>
  );
}
