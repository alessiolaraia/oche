// Schreibt die Teilmenge des Modellvokabulars, die die Grammatik braucht, nach test/fixtures/
// (damit Unit-Tests ohne das 45-MB-Modell laufen). Aufruf: node scripts/vocab-subset.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { buildGrammar } from '../src/voice/commands.ts';
import { TRIGGER_SUGGESTIONS } from '../src/voice/triggers.ts';

const vocab = new Set(readFileSync('public/models/vosk-model-small-de-0.15.words.txt', 'utf8').split('\n'));
const wanted = new Set<string>();
for (const trigger of TRIGGER_SUGGESTIONS) {
  for (const p of buildGrammar({ trigger, singleDarts: true, vocab: null }))
    for (const w of p.split(' ')) wanted.add(w);
}
const subset = [...wanted].filter((w) => vocab.has(w)).sort();
writeFileSync('test/fixtures/vocab-subset.txt', subset.join('\n') + '\n');
console.log(`${subset.length} von ${wanted.size} Grammatik-Wörtern im Vokabular`);
console.log('fehlen:', [...wanted].filter((w) => !vocab.has(w)).join(', '));
