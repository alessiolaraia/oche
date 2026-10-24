import { expect, test } from '@playwright/test';
import { collectConsoleErrors, enterScore, freshApp } from './helpers';

test('Bot-Gegner wirft selbst', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page);
  await page.goto('./');
  await page.getByRole('switch', { name: 'Bot' }).nth(1).check();
  await page.getByTestId('custom-start').click();
  await page.getByRole('button', { name: 'Tippen' }).click();
  await enterScore(page, 60);
  // Bot ist dran und wirft nach ~2 s; danach ist wieder Spieler 1 am Zug
  await expect(page.getByTestId('active-player')).toHaveText('Spieler 1', { timeout: 8_000 });
  await page.screenshot({ path: 'test-results/screens/bot.png' });
  await expect(page.getByTestId('rest-1')).not.toHaveText('501');
  expect(errors).toEqual([]);
});

test('Around the Clock per Touch bis zum Ende', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page, { voice: { enabled: false } });
  await page.goto('./#/training');
  await page.getByTestId('training-atc').click();
  for (let i = 0; i < 7; i++)
    await page.getByRole('group', { name: 'Treffer' }).getByRole('button', { name: '3' }).click();
  await expect(page.getByText('Geschafft mit 21 Darts')).toBeVisible();
  await page.getByRole('button', { name: 'Beenden' }).click();
  await expect(page.getByText(/Bestes Ergebnis: 21 Darts/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Checkout-Training: Runde auswerten und nächstes Ziel', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page, { voice: { enabled: false } });
  await page.goto('./#/training');
  await page.getByTestId('training-checkout').click();
  const status = page.getByTestId('training-status');
  await expect(status).toContainText('geschafft 0 von 0');
  const target = Number(await page.getByTestId('remaining').textContent());
  await page.getByRole('button', { name: 'Tippen' }).click();
  await enterScore(page, target);
  await expect(status).toContainText('geschafft 1 von 1');
  // nach kurzer Pause neues Ziel
  await expect(status).not.toContainText(`Ziel ${target},`, { timeout: 5_000 });
  expect(errors).toEqual([]);
});
