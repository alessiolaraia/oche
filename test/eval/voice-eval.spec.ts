import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { EvalConfig, FileResult } from '../../src/eval/harness';

// Sprach-Eval (docs/VOICE_MASTERPROMPT.md §9): Korpus → echte Kette im Browser → Kennzahlen → reports/voice-eval.md
// Aufruf: npm run eval:voice   (EVAL_CONFIG='{"gainDb":18}' für Abweichungen, EVAL_BASELINE=1 schreibt die Baseline)

interface Entry {
  file: string;
  set: 'commands' | 'confusables' | 'negatives';
  expected: Record<string, unknown> | null;
  seconds: number;
  speechEnd: number | null;
  tags: string[];
}

const CORPUS = 'test/voice-corpus';
const DEFAULTS: EvalConfig = {
  gainDb: 20,
  gateDb: -30,
  inputDb: -14,
  minConfidence: 0.55,
  mode: 'trigger',
  trigger: 'wurf',
  singleDarts: true,
};
const cfg: EvalConfig = {
  ...DEFAULTS,
  ...(process.env.EVAL_CONFIG ? JSON.parse(process.env.EVAL_CONFIG) : {}),
};
const LABEL = process.env.EVAL_LABEL ?? 'aktuell';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const label = (c: Record<string, unknown> | null | undefined) =>
  !c ? '–' : c.type === 'score' ? String(c.value) : c.type === 'correct' ? `korr ${c.value}` : String(c.type);

test('Sprach-Eval über den Korpus', async ({ page }) => {
  test.setTimeout(60 * 60_000);
  const index: Entry[] = JSON.parse(readFileSync(`${CORPUS}/index.json`, 'utf8'));
  const realOnly = existsSync(`${CORPUS}/real/index.json`)
    ? (JSON.parse(readFileSync(`${CORPUS}/real/index.json`, 'utf8')) as Entry[]).map((e) => ({
        ...e,
        file: `real/${e.file}`,
        tags: [...e.tags, 'echt'],
      }))
    : [];
  const entries = [...realOnly, ...index];

  await page.goto('./#/eval');
  await expect(page.getByTestId('eval-ready')).toHaveText('Eval bereit', { timeout: 60_000 });
  await page.evaluate((c) => window.__ocheEval!.init(c), cfg);

  const results: { e: Entry; r: FileResult }[] = [];
  for (const e of entries) {
    const b64 = readFileSync(`${CORPUS}/${e.file}`).toString('base64');
    const r = await page.evaluate(([b, c]) => window.__ocheEval!.runFile(b, c), [b64, cfg] as const);
    results.push({ e, r });
  }

  // Latenz: einige Befehle in Echtzeit abspielen
  const latencySet = entries
    .filter((e) => e.set === 'commands' && e.tags.includes('ruhig') && e.expected?.type === 'score')
    .slice(0, 12);
  const latencies: number[] = [];
  for (const e of latencySet) {
    const b64 = readFileSync(`${CORPUS}/${e.file}`).toString('base64');
    const r = await page.evaluate(
      ([b, c, end]) => window.__ocheEval!.runFile(b, c, { realtime: true, speechEnd: end }),
      [b64, cfg, e.speechEnd] as const,
    );
    if (r.latencyMs !== null) latencies.push(r.latencyMs);
  }

  // ---- Kennzahlen ----
  const positives = results.filter(({ e }) => e.set !== 'negatives');
  const ok = (x: { e: Entry; r: FileResult }) =>
    x.r.accepted.length === 1 && isDeepStrictEqual(x.r.accepted[0], x.e.expected);
  const byGroup = (pred: (e: Entry) => boolean) => {
    const g = positives.filter(({ e }) => pred(e));
    return { n: g.length, ok: g.filter(ok).length, pct: pct(g.filter(ok).length, g.length) };
  };
  const negatives = results.filter(({ e }) => e.set === 'negatives');
  const negHours = negatives.reduce((s, { e }) => s + e.seconds, 0) / 3600;
  const falseAccepts = negatives.flatMap(({ e, r }) =>
    r.accepted.map((c) => ({ file: e.file, got: label(c as Record<string, unknown>) })),
  );
  const wrong = positives.filter((x) => x.r.accepted.length > 0 && !ok(x));
  const missed = positives.filter((x) => x.r.accepted.length === 0);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (q: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : null;

  const confusion = new Map<string, Map<string, number>>();
  for (const { e, r } of results.filter(({ e }) => e.set === 'confusables')) {
    const exp = label(e.expected);
    const got = r.accepted.length
      ? r.accepted.map((c) => label(c as Record<string, unknown>)).join('+')
      : 'nichts';
    const row = confusion.get(exp) ?? new Map<string, number>();
    row.set(got, (row.get(got) ?? 0) + 1);
    confusion.set(exp, row);
  }

  const metrics = {
    label: LABEL,
    config: cfg,
    files: results.length,
    accuracy: byGroup(() => true),
    commands: byGroup((e) => e.set === 'commands'),
    confusables: byGroup((e) => e.set === 'confusables'),
    ruhig: byGroup((e) => e.tags.includes('ruhig')),
    laut: byGroup((e) => e.tags.includes('laut')),
    echt: byGroup((e) => e.tags.includes('echt')),
    wrongAccepts: wrong.length,
    falseAccepts: falseAccepts.length,
    negativeMinutes: Math.round(negHours * 600) / 10,
    falseAcceptsPerHour: negHours ? Math.round((falseAccepts.length / negHours) * 10) / 10 : 0,
    latencyP50: p(0.5),
    latencyP95: p(0.95),
  };
  writeFileSync('reports/voice-eval.json', JSON.stringify(metrics, null, 1));

  const voices = [
    ...new Set(positives.flatMap(({ e }) => e.tags.filter((t) => !['ruhig', 'laut', 'echt'].includes(t)))),
  ];
  const md = [
    `# Sprach-Eval – ${LABEL}`,
    '',
    `Korpus: ${results.length} Dateien (${positives.length} Befehle, ${negatives.length} Negative = ${metrics.negativeMinutes} min).`,
    `Konfiguration: \`${JSON.stringify(cfg)}\``,
    '',
    '| Metrik | Wert | Ziel |',
    '|---|---|---|',
    `| Richtig erkannt (alle) | **${metrics.accuracy.pct} %** (${metrics.accuracy.ok}/${metrics.accuracy.n}) | ≥ 97 % |`,
    `| – ruhiger Raum | ${metrics.ruhig.pct} % | |`,
    `| – lauter Raum (Gerede, Einschläge) | ${metrics.laut.pct} % | |`,
    `| – Verwechslungspaare | ${metrics.confusables.pct} % | |`,
    ...(metrics.echt.n ? [`| – echte Aufnahmen | ${metrics.echt.pct} % (${metrics.echt.n}) | |`] : []),
    `| Falsch übernommen (falsche Zahl) | ${metrics.wrongAccepts} | 0 unbemerkt |`,
    `| Falsch-Annahmen in Negativen | ${metrics.falseAccepts} in ${metrics.negativeMinutes} min = **${metrics.falseAcceptsPerHour}/h** | ≤ 2/h |`,
    `| Latenz Sprechende → Entscheidung | p50 ${metrics.latencyP50 ?? '–'} ms, p95 ${metrics.latencyP95 ?? '–'} ms | ≤ 700 ms |`,
    '',
    '## Nach Stimme',
    '',
    ...voices.map((v) => `- ${v}: ${byGroup((e) => e.tags.includes(v)).pct} %`),
    '',
    '## Verwechslungsmatrix (erwartet → erkannt)',
    '',
    '| erwartet | erkannt |',
    '|---|---|',
    ...[...confusion.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([exp, row]) => `| ${exp} | ${[...row.entries()].map(([g, n]) => `${g} ×${n}`).join(', ')} |`),
    '',
    '## Fehler',
    '',
    ...wrong.map(
      ({ e, r }) =>
        `- FALSCH ${e.file}: erwartet ${label(e.expected)}, übernommen ${r.accepted.map((c) => label(c as Record<string, unknown>)).join('+')} („${r.transcripts.map((t) => t.text).join(' | ')}“)`,
    ),
    ...missed.map(
      ({ e, r }) =>
        `- VERPASST ${e.file}: erwartet ${label(e.expected)}, gehört „${r.transcripts.map((t) => `${t.text} (${t.confidence === null ? '–' : Math.round(t.confidence * 100)} %)`).join(' | ') || 'nichts'}“`,
    ),
    ...falseAccepts.map((f) => `- FALSCH-ANNAHME ${f.file}: ${f.got}`),
    '',
  ].join('\n');
  writeFileSync('reports/voice-eval.md', md);
  if (process.env.EVAL_BASELINE)
    writeFileSync('reports/voice-eval.baseline.json', JSON.stringify(metrics, null, 1));
  console.log(md.split('## Nach Stimme')[0]);

  // Regression gegen die gespeicherte Baseline
  if (!process.env.EVAL_BASELINE && existsSync('reports/voice-eval.baseline.json')) {
    const base = JSON.parse(readFileSync('reports/voice-eval.baseline.json', 'utf8'));
    expect(metrics.accuracy.pct, 'Trefferquote schlechter als Baseline').toBeGreaterThanOrEqual(
      base.accuracy.pct - 1,
    );
    expect(metrics.falseAccepts, 'mehr Falsch-Annahmen als Baseline').toBeLessThanOrEqual(base.falseAccepts);
    expect(metrics.wrongAccepts, 'mehr falsche Zahlen als Baseline').toBeLessThanOrEqual(base.wrongAccepts);
  }
});
