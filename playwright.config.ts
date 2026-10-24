import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  // BASE_PATH=/oche/ testet den GitHub-Pages-Build unter Unterpfad
  use: { baseURL: `http://localhost:4173${process.env.BASE_PATH ?? '/'}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: '**/voice/**',
    },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testIgnore: '**/voice/**' },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] }, testIgnore: '**/voice/**' },
    { name: 'iphone', use: { ...devices['iPhone 15'] }, testIgnore: '**/voice/**' },
    // Sprach-Eval über den Korpus (npm run eval:voice)
    {
      name: 'eval',
      testDir: 'test/eval',
      use: { ...devices['Desktop Chrome'] },
    },
    // Sprach-E2E (Fake-Mikrofon, echtes Vosk) – braucht Echtzeit-CPU, daher eigenes Projekt, seriell
    {
      name: 'voice',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: '**/voice/**/*.spec.ts',
    },
  ],
});
