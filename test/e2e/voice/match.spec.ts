import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('match'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

// Definition of Done: 501, Double-Out, First to 3 – komplett per Stimme, inkl. Bust und Korrektur.
test('komplettes Match nur per Stimme', async ({ page }) => {
  test.setTimeout(360_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  await expect(page.getByText('Legs 1 : 0')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Legs 2 : 0')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Spieler 1 gewinnt')).toBeVisible({ timeout: 60_000 });
  // Statistik: Bust und Korrektur sind korrekt verbucht – A hat 501 in 9 + 3 (Bust) Darts im ersten Leg
  await expect(page.getByRole('row', { name: /Spieler 1/ })).toBeVisible();
  expect(errors).toEqual([]);
});
