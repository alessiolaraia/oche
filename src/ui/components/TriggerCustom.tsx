import { useEffect, useState } from 'react';
import { useSettings } from '../../store/settings';
import { loadVocab } from '../../voice/vocab';
import { capitalize } from './controls';

/** Eigenes Triggerwort – nur Wörter, die das Sprachmodell kennt. */
export function TriggerCustom() {
  const trigger = useSettings((s) => s.voice.trigger);
  const update = useSettings((s) => s.update);
  const [vocab, setVocab] = useState<Set<string> | null>(null);
  const [failed, setFailed] = useState(false);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    loadVocab().then(setVocab, () => setFailed(true));
  }, []);

  const known = custom.trim() && vocab ? vocab.has(custom.trim().toLowerCase()) : null;

  return (
    <div className="stack trigger-custom">
      <label className="label" htmlFor="custom-trigger">
        Eigenes Triggerwort
        <small>
          {known === true
            ? 'Kennt das Sprachmodell.'
            : known === false
              ? 'Kennt das Sprachmodell nicht – bitte ein anderes Wort.'
              : failed
                ? 'Wortliste nicht geladen – Prüfung nicht möglich.'
                : `Aktuell: „${capitalize(trigger)}“.`}
        </small>
      </label>
      <div className="trigger-custom-row">
        <input
          id="custom-trigger"
          type="text"
          value={custom}
          placeholder={capitalize(trigger)}
          onChange={(e) => setCustom(e.target.value)}
          autoCapitalize="none"
        />
        <button
          className="btn"
          disabled={known !== true}
          onClick={() => {
            update('voice', { trigger: custom.trim().toLowerCase() });
            setCustom('');
          }}
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}
