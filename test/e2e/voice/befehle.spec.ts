import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('befehle'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('Befehlsfolge: 141, 45 → Korrektur 60, Einzeldarts, Überworfen, Zurück, Rest', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  const T = { timeout: 30_000 };
  await expect(page.getByTestId('rest-0')).toHaveText('360', T); // A: Wurf hunderteinundvierzig
  await expect(page.getByTestId('rest-1')).toHaveText('456', T); // B: Wurf fünfundvierzig
  await expect(page.getByTestId('rest-1')).toHaveText('441', T); // Korrektur sechzig
  await expect(page.getByTestId('rest-0')).toHaveText('275', T); // T20 D10 S5 = 85
  await expect(page.getByText('Zuletzt: Spieler 2 – Bust')).toBeVisible(T); // Überworfen
  await expect(page.getByText('Zuletzt: Spieler 1 – 85')).toBeVisible(T); // Zurück
  await expect(page.getByTestId('active-player')).toHaveText('Spieler 2');
  await expect(page.getByTestId('remaining')).toHaveText('441');
  expect(errors).toEqual([]);
});
