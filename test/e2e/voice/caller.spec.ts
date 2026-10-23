import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('wurf-sechzig'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('mit Ansagen und Effekten: Erkennung läuft weiter, Echo-Schutz blockiert nicht dauerhaft', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('oche-settings')!);
    raw.state.caller = { ...raw.state.caller, enabled: true, sfx: true };
    localStorage.setItem('oche-settings', JSON.stringify(raw));
  });
  await page.reload();
  await quickStartWithVoice(page);
  await expect(page.getByTestId('rest-0')).toHaveText('441', { timeout: 45_000 });
  await expect(page.getByTestId('rest-1')).toHaveText('441', { timeout: 20_000 });
  expect(errors).toEqual([]);
});
