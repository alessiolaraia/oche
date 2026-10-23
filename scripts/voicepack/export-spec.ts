// Schreibt die Clip-Liste (aus src/caller/voicepack.ts) als JSON für den Python-Generator.
import { writeFileSync } from 'node:fs';
import { packClips, type PackLang } from '../../src/caller/voicepack.ts';

for (const lang of ['de', 'en'] as PackLang[]) {
  const clips = packClips(lang);
  writeFileSync(`.cache/voicepack-${lang}.json`, JSON.stringify(clips, null, 1));
  console.log(lang, clips.length, 'Clips');
}
