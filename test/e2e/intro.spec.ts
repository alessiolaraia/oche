import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors, freshApp } from './helpers';

/** Erster Aufruf: Service Worker installiert sich und lädt die Seite neu – das abwarten. */
async function openSetup(page: Page) {
  await page.goto('./#/');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload();
  await expect(page.getByTestId('quick-start')).toBeVisible();
}

// 3D per Software-Rendering braucht die ganze CPU: nacheinander statt parallel
test.describe.configure({ mode: 'serial' });

test.describe(() => {
  test('Intro vor dem Spiel: 3D-Würfe, 180, Namen, dann Spielbild', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectConsoleErrors(page);
    await freshApp(page, { display: { intro: true }, voice: { enabled: false } });
    await openSetup(page);
    await page.getByTestId('quick-start').click();
    const intro = page.getByRole('dialog', { name: 'Spieler 1 gegen Spieler 2' });
    await expect(intro).toBeVisible();
    await expect(intro.getByText('180', { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(intro).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('remaining')).toHaveText('501');
    expect(errors).toEqual([]);
  });
});

test('Intro lässt sich per Tippen überspringen – danach läuft das Spiel', async ({ page }) => {
  await freshApp(page, { display: { intro: true }, voice: { enabled: false } });
  await openSetup(page);
  await page.getByTestId('quick-start').click();
  const intro = page.getByTestId('match-intro');
  // ohne WebGL entfällt das Intro von selbst
  if (await intro.isVisible()) await intro.dispatchEvent('pointerdown');
  await expect(intro).toBeHidden();
  await expect(page.getByTestId('remaining')).toHaveText('501');
});
