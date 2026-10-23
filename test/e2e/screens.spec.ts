import { expect, test } from '@playwright/test';
import { collectConsoleErrors, enterScore, freshApp } from './helpers';

// Screenshots aller Screens je Viewport (Projekt) – zur Sichtprüfung unter test-results/screens/
test('Screenshots aller Screens', async ({ page }, info) => {
  const errors = collectConsoleErrors(page);
  const shot = (name: string) => page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  await freshApp(page);
  await page.goto('/');
  await expect(page.getByTestId('quick-start')).toBeVisible();
  await shot('setup');

  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('remaining')).toHaveText('501');
  await shot('game');
  await page.getByRole('button', { name: 'Tippen' }).click();
  await enterScore(page, 100);
  await enterScore(page, 45);
  await enterScore(page, 140);
  await page.waitForTimeout(1000);
  await shot('game-pad');
  await page.getByRole('button', { name: 'Einzeldarts' }).click();
  await shot('game-boardpad');
  await page.getByRole('button', { name: 'Pad zu' }).click();
  await shot('game-checkout');

  await page.goto('/#/settings');
  await shot('settings');
  await page.goto('/#/stats');
  await shot('stats');
  await page.goto('/#/onboarding');
  await shot('onboarding');
  expect(errors).toEqual([]);
});
