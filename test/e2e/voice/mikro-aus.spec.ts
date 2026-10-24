import { expect, test } from '@playwright/test';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('wurf-sechzig'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

/** Merkt sich alle Mikro-Streams, damit der Test sehen kann, ob noch eine Spur offen ist. */
async function trackStreams(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c);
      w.__streams.push(s);
      return s;
    };
  });
}

const liveTracks = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __streams: MediaStream[] }).__streams
        .flatMap((s) => s.getTracks())
        .filter((t) => t.readyState === 'live').length,
  );

test('Spiel sofort beenden, während das Mikro noch startet: danach ist das Mikro wirklich aus', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await trackStreams(page);
  await warmUp(page);
  await page.goto('./#/');
  await page.getByTestId('quick-start').click();
  // noch während des Ladens raus
  await page.getByRole('button', { name: 'Menü' }).click();
  await page.getByRole('button', { name: 'Spiel beenden' }).click();
  await page.waitForTimeout(8000);
  expect(await liveTracks(page)).toBe(0);
});

test('Zurück zum Startbildschirm: Mikro aus; zurück ins Spiel: wieder an', async ({ page }) => {
  test.setTimeout(240_000);
  await trackStreams(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  await expect.poll(() => liveTracks(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.goto('./#/stats');
  await expect.poll(() => liveTracks(page), { timeout: 5_000 }).toBe(0);
  await page.goto('./#/game');
  await expect.poll(() => liveTracks(page), { timeout: 30_000 }).toBeGreaterThan(0);
});
