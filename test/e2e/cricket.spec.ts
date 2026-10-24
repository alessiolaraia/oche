import { expect, test } from '@playwright/test';
import { collectConsoleErrors, freshApp } from './helpers';

test('Cricket: Marks, Punkte, Spielerwechsel, Zurück und Sieg', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await freshApp(page, { voice: { enabled: false } });
  await page.goto('./#/');
  await page.getByTestId('setup-cricket').click();
  const tap = (name: string) => page.getByRole('button', { name, exact: true }).click();

  // A: T20 (zu), T20 (+60), daneben → B ist dran
  await tap('Triple 20');
  await tap('Triple 20');
  await tap('Daneben');
  await expect(page.getByTestId('ck-points-0')).toHaveText('60');
  // B: Fehler korrigieren per Zurück
  await tap('Single 19');
  await page.getByRole('button', { name: 'Wurf zurück' }).click();
  await page.getByRole('button', { name: 'Fertig' }).click();

  // A schließt den Rest; nach drei Darts wechselt es automatisch, B wirft daneben
  for (const n of ['Triple 19', 'Triple 18', 'Triple 17']) await tap(n);
  for (let i = 0; i < 3; i++) await tap('Daneben');
  for (const n of ['Triple 16', 'Triple 15', 'Bull']) await tap(n);
  for (let i = 0; i < 3; i++) await tap('Daneben');
  await tap('Single Bull');
  await expect(page.getByRole('dialog', { name: 'Cricket vorbei' })).toBeVisible();
  await expect(page.getByText('Spieler 1 gewinnt')).toBeVisible();
  expect(errors).toEqual([]);
});
