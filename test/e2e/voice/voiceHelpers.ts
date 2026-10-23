import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { freshApp } from '../helpers';

/** Playwright-Optionen: WAV aus test/audio/ als Mikrofon (nur Chromium). */
export function fakeMic(name: string) {
  return {
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${resolve(`test/audio/${name}.wav`)}`,
      ],
    },
  };
}

/**
 * Modell einmal laden (landet in IndexedDB), dann Mikro neu starten, damit die WAV von vorn läuft
 * (12 s Stille am Anfang decken das Laden aus dem Cache ab).
 */
export async function warmUp(page: Page, settings: Record<string, unknown> = {}) {
  await freshApp(page, { voice: { engine: 'vosk', ...settings } });
  await page.goto('/#/debug');
  await page.getByRole('button', { name: 'Mikro starten' }).click();
  await expect(page.getByText('Vosk (offline, Grammatik)')).toBeVisible({ timeout: 150_000 });
  await page.getByRole('button', { name: 'Mikro stoppen' }).click();
}

export async function quickStartWithVoice(page: Page) {
  await page.goto('/#/');
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('remaining')).toHaveText('501');
}
