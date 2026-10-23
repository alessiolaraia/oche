import type { Page } from '@playwright/test';

/** App ohne Onboarding und ohne Ansagen starten (TTS stört Tests nicht, ist aber laut). */
export async function freshApp(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript((extra) => {
    if (sessionStorage.getItem('oche-test-init')) return;
    sessionStorage.setItem('oche-test-init', '1');
    localStorage.setItem(
      'oche-settings',
      JSON.stringify({
        state: { onboarded: true, caller: { enabled: false, sfx: false }, ...extra },
        version: 1,
      }),
    );
  }, settings);
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export async function enterScore(page: Page, score: number) {
  for (const ch of String(score)) await page.getByRole('button', { name: ch, exact: true }).click();
  await page.getByRole('button', { name: 'Eintragen' }).click();
}
