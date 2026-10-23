import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from '../helpers';
import { fakeMic, quickStartWithVoice, warmUp } from './voiceHelpers';

test.use(fakeMic('smalltalk'));
test.skip(({ browserName }) => browserName !== 'chromium', 'Fake-Audio nur in Chromium');

test('Gerede am Tisch (auch „sechzig“ ohne Triggerwort) zählt nicht', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectConsoleErrors(page);
  await warmUp(page);
  await quickStartWithVoice(page);
  await page.waitForTimeout(40_000);
  await expect(page.getByTestId('remaining')).toHaveText('501');
  await expect(page.getByTestId('rest-1')).toHaveText('501');
  expect(errors).toEqual([]);
});
