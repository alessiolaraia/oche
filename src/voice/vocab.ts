export const MODEL_NAME = 'vosk-model-small-de-0.15';
export const modelUrl = () => `${import.meta.env.BASE_URL}models/${MODEL_NAME}.tar.gz`;
const vocabUrl = () => `${import.meta.env.BASE_URL}models/${MODEL_NAME}.words.txt`;

let vocabPromise: Promise<Set<string>> | null = null;

/** Wortliste des Modells (aus Gr.fst extrahiert, siehe scripts/fetch-model.mjs). */
export function loadVocab(): Promise<Set<string>> {
  vocabPromise ??= fetch(vocabUrl())
    .then((r) => {
      if (!r.ok) throw new Error(`Wortliste nicht gefunden (${r.status})`);
      return r.text();
    })
    .then((t) => new Set(t.split('\n').filter(Boolean)))
    .catch((e: unknown) => {
      vocabPromise = null;
      throw e;
    });
  return vocabPromise;
}
