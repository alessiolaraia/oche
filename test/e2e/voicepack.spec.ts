import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectConsoleErrors, enterScore, freshApp } from './helpers';

// Klang-Paket: Ansagen kommen als Clips aus public/voices/, die Systemstimme springt nur ein, wo ein Clip fehlt.
// Die echten Pakete liefert ein Sprecher nach; hier simuliert ein Mini-Paket aus test/fixtures/voices/.
const FIX = 'test/fixtures/voices';

async function fakePacks(page: Page, alts = false) {
  await page.route('**/voices/**', async (route) => {
    const url = new URL(route.request().url());
    const m = /voices\/(?:(index)\.json|oche-(de|en)\/(.+))$/.exec(url.pathname);
    if (!m) return route.fulfill({ status: 404 });
    if (m[1]) return route.fulfill({ json: { packs: ['oche-de', 'oche-en'] } });
    const lang = m[2]!;
    const file = m[3]!;
    if (file === 'manifest.json') {
      const clips: Record<string, number> =
        lang === 'de'
          ? { score_60: 1, rest_441: 1.5 }
          : { score_180: 2, ...(alts ? { 'score_180~2': 2 } : {}) };
      return route.fulfill({
        json: {
          id: `oche-${lang}`,
          lang,
          name: 'Test',
          license: '',
          format: 'm4a',
          clips,
          ...(alts ? { alts: { score_180: 2 } } : {}),
        },
      });
    }
    const key = file.replace(/\.m4a$/, '').replace(/~\d+$/, '');
    try {
      return route.fulfill({ body: readFileSync(`${FIX}/${lang}-${key}.m4a`), contentType: 'audio/mp4' });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const orig = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      if (u.text.trim()) spoken.push(u.text);
      orig(u);
    };
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

async function startAndEnter(page: Page, score: number) {
  await page.goto('./');
  await page.getByTestId('quick-start').click();
  await page.getByRole('button', { name: 'Tippen' }).click();
  await enterScore(page, score);
}

test('Nüchtern: „Sechzig“ und „Rest 441“ kommen aus dem Paket, nicht von der Systemstimme', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await fakePacks(page);
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'plain' } });
  const score = page.waitForRequest(/voices\/oche-de\/score_60\.m4a/);
  const rest = page.waitForRequest(/voices\/oche-de\/rest_441\.m4a/);
  await startAndEnter(page, 60);
  await score;
  await rest;
  await page.waitForTimeout(500);
  expect((await spoken(page)).filter((t) => /Sechzig|Rest/.test(t))).toEqual([]);
  expect(errors).toEqual([]);
});

// Playwright-WebKit lässt speechSynthesis.speak nicht abfangen (0 Stimmen, Zuweisung wirkungslos)
const NO_TTS_SPY = 'In Playwright-WebKit lässt sich die Systemstimme nicht beobachten';

test('Fehlender Clip → Systemstimme springt ein', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', NO_TTS_SPY);
  await fakePacks(page);
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'plain' } });
  await startAndEnter(page, 45); // score_45 und rest_456 fehlen im Mini-Paket
  await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Fünfundvierzig.'));
});

test('Arena: 180 kommt aus dem englischen Paket, mehrere Takes werden genutzt', async ({ page }) => {
  await fakePacks(page, true);
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'arena' } });
  const req = page.waitForRequest(/voices\/oche-en\/score_180(~2)?\.m4a/);
  await startAndEnter(page, 180);
  await req;
});

test('Ohne installiertes Paket: Systemstimme, keine Konsolenfehler', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', NO_TTS_SPY);
  const errors = collectConsoleErrors(page);
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'plain' } });
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const orig = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      spoken.push(u.text);
      orig(u);
    };
  });
  await startAndEnter(page, 60);
  await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Sechzig.'));
  await page.goto('./#/settings');
  await expect(page.getByText('noch kein Ansager-Paket installiert')).toBeVisible();
  expect(errors).toEqual([]);
});
