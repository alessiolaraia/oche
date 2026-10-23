import { expect, test } from '@playwright/test';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('wurf-sechzig'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('Spracherkennung funktioniert offline, nachdem das Modell einmal geladen wurde', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await warmUp(page);
  await context.setOffline(true);
  await page.reload();
  await quickStartWithVoice(page);
  await expect(page.getByTestId('rest-0')).toHaveText('441', { timeout: 45_000 });
});
