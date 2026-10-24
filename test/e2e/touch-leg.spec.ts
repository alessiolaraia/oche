import { expect, test } from '@playwright/test';
import { collectConsoleErrors, enterScore, freshApp } from './helpers';

test('komplettes 501-Leg per Touch inkl. Bust, Korrektur per Zurück und Checkout', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page);
  await page.goto('./');
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('remaining')).toHaveText('501');

  await page.getByRole('button', { name: 'Tippen' }).click();

  // A 180, B 60, A 180, B 60
  await enterScore(page, 180);
  await expect(page.getByTestId('remaining')).toHaveText('501'); // jetzt B am Zug
  await expect(page.getByTestId('rest-0')).toHaveText('321');
  await enterScore(page, 60);
  await enterScore(page, 180);
  await enterScore(page, 60);
  await expect(page.getByTestId('remaining')).toHaveText('141');
  await expect(page.getByTestId('checkout-route')).toHaveText('T20 T19 D12');

  // Unmögliche Aufnahme wird abgelehnt
  await enterScore(page, 179);
  await expect(page.getByTestId('remaining')).toHaveText('141');

  // Bust: 150 > 141
  await enterScore(page, 150);
  await expect(page.getByTestId('rest-0')).toHaveText('141');
  // B tippt falsch (45), korrigiert per Zurück auf 60
  await enterScore(page, 45);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await enterScore(page, 60);
  await expect(page.getByTestId('rest-1')).toHaveText('321');

  // A checkt 141
  await enterScore(page, 141);

  // Pad schließen: dann ist der Fokus mit Leg-Stand und Rest wieder sichtbar (Handy hoch blendet ihn aus)
  await page.getByRole('button', { name: 'Pad zu' }).click();
  await expect(page.getByText('Legs 1 : 0')).toBeVisible();
  await expect(page.getByTestId('remaining')).toHaveText('501');
  await expect(page.getByTestId('active-player')).toHaveText('Spieler 2');

  // Reload: Spiel wird aus IndexedDB fortgesetzt
  await page.reload();
  await expect(page.getByText('Legs 1 : 0')).toBeVisible();
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Laufendes Spiel fortsetzen' }).click();
  await expect(page.getByTestId('active-player')).toHaveText('Spieler 2');

  expect(errors).toEqual([]);
});
