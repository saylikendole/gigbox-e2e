import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const STORAGE_STATE = '.auth/maya.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry on CI only, and every retry is recorded with a trace.
  // A test that needs its retry shows up as "flaky" in the report, so it gets fixed rather than hidden.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['blob'], ['github'], ['list']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
      grep: /@smoke/, // cross-browser check on the critical paths only
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
      grep: /@smoke/,
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run start:test',
        url: `${BASE_URL}/api/events`,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT) },
        timeout: 30_000,
      },
});
