import { expect, test } from '@playwright/test';
import { freshApp } from './helpers';

test('App startet offline (Service Worker)', async ({ page, context }) => {
  await freshApp(page);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('quick-start')).toBeVisible();
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('remaining')).toHaveText('501');
  // Schriften kommen aus dem Cache
  expect(await page.evaluate(() => document.fonts.check('900 40px "Big Shoulders Display Variable"'))).toBe(
    true,
  );
});

test('PWA ist installierbar (Chrome-Installierbarkeitsprüfung)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP nur in Chromium');
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  const manifest = await cdp.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
});
