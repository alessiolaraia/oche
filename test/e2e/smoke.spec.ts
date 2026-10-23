import { expect, test } from '@playwright/test';

test('App startet ohne Konsolenfehler', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});
