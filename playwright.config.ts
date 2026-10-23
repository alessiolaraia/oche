import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
});
