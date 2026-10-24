// Erzeugt das Aufnahme-Skript für einen Sprecher aus der Clip-Liste (src/caller/voicepack.ts):
//   docs/sprecher/script-en.json  – Reihenfolge für das Schneidewerkzeug (scripts/voicepack/cut.py)
//   docs/sprecher/Oche-Recording-Script.csv / .html / .pdf – für den Sprecher
// Aufruf: npx tsx scripts/voicepack/make-script.ts
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { packClips, type Clip, type Level } from '../../src/caller/voicepack.ts';

const OUT = 'docs/sprecher';
/** Zeilen mit mehreren Takes (Abwechslung in der App). */
const MULTI_TAKE: Record<string, number> = { score_180: 3, match: 3 };

interface Line {
  no: number;
  text: string;
  keys: string[];
  level: Level;
  takes: number;
  section: string;
}

const NOTE: Record<Level, string> = {
  calm: 'Calm and clear – announcing information in the hall, not shouted.',
  normal: 'Clear with a little lift – a decent score.',
  ton: 'Raised and energetic – a good score, the crowd reacts.',
  big: 'Big call – build the energy, lean into the last word.',
  max: 'Maximum! Full voice, drawn out, your signature call.',
};

/** Eigene Hinweise für Ansagen, die keine Punktzahl sind. */
const KEY_NOTE: Record<string, string> = {
  game_on: 'Start of the match – crisp, confident, a call to attention.',
  new_leg: 'Neutral and clear.',
  match: 'Match won! Full voice, the biggest moment of the night.',
  high_finish: 'Celebrating a big checkout – excited.',
  training_ok: 'Short and celebratory.',
};

const noteFor = (l: Line) => l.keys.map((k) => KEY_NOTE[k]).find(Boolean) ?? NOTE[l.level];

const SECTIONS: { title: string; intro: string; pick: (c: Clip) => boolean }[] = [
  {
    title: 'Short phrases',
    intro: 'Calm, matter-of-fact.',
    pick: (c) => !/^(score|require|target|leg)_/.test(c.key) && c.level === 'calm',
  },
  {
    title: 'Checkout requirements',
    intro: 'Calm, informative: “You require …”.',
    pick: (c) => c.key.startsWith('require_'),
  },
  { title: 'Practice targets', intro: 'Calm.', pick: (c) => c.key.startsWith('target_') },
  {
    title: 'Scores 0–99',
    intro: 'Low scores calm and crisp, 60+ with a little more lift.',
    pick: (c) => /^score_\d+$/.test(c.key) && Number(c.key.slice(6)) < 100,
  },
  {
    title: 'Scores 100–177',
    intro: 'Ton-plus: raised and energetic, getting bigger as the numbers grow.',
    pick: (c) => /^score_\d+$/.test(c.key) && Number(c.key.slice(6)) >= 100 && Number(c.key.slice(6)) < 180,
  },
  {
    title: 'Big calls',
    intro: 'Save your voice for these. Full energy.',
    pick: () => true,
  },
];

function build(): Line[] {
  const clips = packClips('en');
  const used = new Set<string>();
  const byText = new Map<string, Line>();
  const lines: Line[] = [];
  for (const s of SECTIONS) {
    for (const c of clips) {
      if (used.has(c.key) || !s.pick(c)) continue;
      used.add(c.key);
      const same = byText.get(c.text);
      if (same) {
        same.keys.push(c.key); // gleicher Text → nur einmal aufnehmen
        continue;
      }
      const line: Line = {
        no: lines.length + 1,
        text: c.text,
        keys: [c.key],
        level: c.level,
        takes: MULTI_TAKE[c.key] ?? 1,
        section: s.title,
      };
      byText.set(c.text, line);
      lines.push(line);
    }
  }
  return lines;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function html(lines: Line[]): string {
  const sections = SECTIONS.map((s) => {
    const rows = lines.filter((l) => l.section === s.title);
    if (!rows.length) return '';
    return `<h2>${esc(s.title)}</h2><p class="intro">${esc(s.intro)}</p>
<table><thead><tr><th>#</th><th>Line</th><th>Delivery</th></tr></thead><tbody>
${rows
  .map(
    (l) =>
      `<tr class="${l.level}"><td>${l.no}</td><td class="line">${esc(l.text)}${
        l.takes > 1 ? ` <span class="takes">× ${l.takes} takes</span>` : ''
      }</td><td>${esc(noteFor(l))}</td></tr>`,
  )
  .join('\n')}
</tbody></table>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Oche – Darts Caller Recording Script</title>
<style>
body{font:11pt/1.4 -apple-system,Helvetica,Arial,sans-serif;color:#1a1714;margin:24px}
h1{font-size:22pt;margin:0 0 4px} h2{font-size:15pt;margin:22px 0 2px;break-after:avoid}
.intro{margin:0 0 8px;color:#555}
table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:3px 6px;border-bottom:1px solid #ddd;vertical-align:top}
th{font-size:9pt;color:#666} td:first-child{width:3em;color:#777;font-variant-numeric:tabular-nums}
td.line{font-weight:600;width:42%} tr{break-inside:avoid}
tr.ton td.line{color:#8a5a00} tr.big td.line{color:#b42a20} tr.max td.line{color:#b42a20;font-size:12.5pt}
.takes{font-weight:400;color:#1d7a45;font-size:9pt}
.box{border:1px solid #1a1714;padding:10px 14px;margin:12px 0} .box li{margin:2px 0}
</style></head><body>
<h1>Darts Caller – Recording Script</h1>
<p>For <b>Oche</b>, a free voice-controlled darts scoring app. ${lines.length} lines, about 12–15 minutes of finished audio.</p>
<div class="box"><b>How to record</b><ul>
<li>Style: an energetic darts caller / MC in a hall – <b>your own style</b>. Please do not imitate any specific real referee or caller.</li>
<li>Dry, close-mic recording: no reverb, no music, no effects, no compression pumping. Same distance to the mic throughout.</li>
<li>WAV, mono, 44.1 or 48 kHz, 24-bit. One or several files, named in order (part1.wav, part2.wav …).</li>
<li>Read the lines <b>in this order</b>. Do <b>not</b> read the line numbers.</li>
<li>Leave about <b>1.5 seconds of silence</b> between lines.</li>
<li>Flubbed a line? Pause, then simply say it again – we keep the last take. No need to edit.</li>
<li>Lines marked “× 3 takes”: say them three times with a pause in between, each a little different.</li>
<li>Numbers are read British style: “one hundred <b>and</b> forty”. 0 is “No score!”.</li>
</ul></div>
${sections}
</body></html>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const lines = build();
  writeFileSync(`${OUT}/script-en.json`, JSON.stringify(lines, null, 1));
  writeFileSync(
    `${OUT}/Oche-Recording-Script.csv`,
    'no,line,takes,delivery,section\n' +
      lines
        .map((l) => [l.no, `"${l.text}"`, l.takes, `"${noteFor(l)}"`, `"${l.section}"`].join(','))
        .join('\n') +
      '\n',
  );
  const page = html(lines);
  writeFileSync(`${OUT}/Oche-Recording-Script.html`, page);
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.setContent(page);
  await p.pdf({
    path: `${OUT}/Oche-Recording-Script.pdf`,
    format: 'A4',
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  const takes = lines.reduce((s, l) => s + l.takes, 0);
  console.log(`${lines.length} Zeilen (${takes} Takes) → ${OUT}/`);
}

void main();
