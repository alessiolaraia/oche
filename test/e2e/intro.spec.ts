import { expect, test } from '@playwright/test';
import { collectConsoleErrors, freshApp } from './helpers';

test('Intro vor dem Spiel: 180, Namen, dann Spielbild – Tippen überspringt', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page, { display: { intro: true }, voice: { enabled: false } });
  await page.goto('./#/');
  await page.getByTestId('quick-start').click();
  const intro = page.getByTestId('match-intro');
  await expect(intro).toBeVisible();
  await expect(intro.getByText('180', { exact: true })).toBeVisible({ timeout: 3000 });
  await expect(intro.getByText('vs')).toBeVisible({ timeout: 3000 });
  await expect(intro).toBeHidden({ timeout: 4000 });
  await expect(page.getByTestId('remaining')).toHaveText('501');

  // Revanche/neues Spiel: wieder Intro, Tippen überspringt sofort
  await page.goto('./#/');
  await page.getByTestId('quick-start').click();
  await expect(intro).toBeVisible();
  await intro.click();
  await expect(intro).toBeHidden();
  expect(errors).toEqual([]);
});
