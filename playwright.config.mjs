import { defineConfig } from '@playwright/test';

// All browser tests target the owner's existing production-preview deployment.
// This file never starts a mock server and never creates a new Supabase project.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.mjs',
  timeout: 90_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'https://oilstation.goldensoft.cloud',
    browserName: 'chromium',
    headless: true,
    trace: 'on',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 20_000,
  },
});
