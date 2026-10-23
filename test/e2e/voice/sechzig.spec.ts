import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('wurf-sechzig'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('„Wurf sechzig“ zieht 60 ab', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  await expect(page.getByTestId('rest-0')).toHaveText('441', { timeout: 45_000 });
  expect(errors).toEqual([]);
});
