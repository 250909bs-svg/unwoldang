import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:42713',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/mock-server.mjs',
      url: 'http://127.0.0.1:42714/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node e2e/support/dev-server.mjs',
      url: 'http://127.0.0.1:42713',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
