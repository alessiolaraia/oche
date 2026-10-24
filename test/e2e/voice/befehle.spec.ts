import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('befehle'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('Befehlsfolge: Zahl, Wurf zurück, Wurf mit Pause – alte Befehle lösen nichts aus', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  const T = { timeout: 30_000 };
  await expect(page.getByTestId('rest-0')).toHaveText('360', T); // A: Wurf hunderteinundvierzig
  await expect(page.getByTestId('rest-1')).toHaveText('456', T); // B: Wurf fünfundvierzig
  await expect(page.getByTestId('rest-1')).toHaveText('501', T); // „Zurück“ allein nichts, „Wurf zurück“ macht rückgängig
  await expect(page.getByTestId('rest-1')).toHaveText('441', T); // B: Wurf sechzig
  await expect(page.getByTestId('rest-0')).toHaveText('260', { timeout: 40_000 }); // A: „Wurf … hundert“ (Überworfen zählt nicht)
  await page.waitForTimeout(6000); // „Korrektur zehn“ darf nichts ändern
  await expect(page.getByTestId('rest-0')).toHaveText('260');
  await expect(page.getByTestId('rest-1')).toHaveText('441');
  expect(errors).toEqual([]);
});
