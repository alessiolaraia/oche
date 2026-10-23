import { expect, test } from '@playwright/test';
import { collectConsoleErrors, enterScore, freshApp } from './helpers';

// Klang-Paket: Ansagen kommen als Clips aus public/voices/, die Systemstimme springt nur für Namen ein.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const orig = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      if (u.text.trim()) spoken.push(u.text);
      orig(u);
    };
  });
});

const spoken = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

test('Nüchtern: „Sechzig“ und „Rest 441“ kommen aus dem deutschen Paket', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'plain' } });
  await page.goto('./');
  await page.getByTestId('quick-start').click();
  await page.getByRole('button', { name: 'Tippen' }).click();
  const score = page.waitForRequest(/voices\/oche-de\/score_60\.m4a/);
  const rest = page.waitForRequest(/voices\/oche-de\/rest_441\.m4a/);
  await enterScore(page, 60);
  await score;
  await rest;
  await page.waitForTimeout(500);
  expect((await spoken(page)).filter((t) => /Sechzig|Rest/.test(t))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Arena: 180 kommt aus dem englischen Paket', async ({ page }) => {
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'pack', style: 'arena' } });
  await page.goto('./');
  await page.getByTestId('quick-start').click();
  await page.getByRole('button', { name: 'Tippen' }).click();
  const req = page.waitForRequest(/voices\/oche-en\/score_180\.m4a/);
  await enterScore(page, 180);
  await req;
});

test('Systemstimme statt Paket, wenn eingestellt', async ({ page }) => {
  await freshApp(page, { caller: { enabled: true, sfx: false, voiceSource: 'system', style: 'plain' } });
  await page.goto('./');
  await page.getByTestId('quick-start').click();
  await page.getByRole('button', { name: 'Tippen' }).click();
  await enterScore(page, 60);
  await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Sechzig.'));
});
