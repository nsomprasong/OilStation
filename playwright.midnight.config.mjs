import {defineConfig} from '@playwright/test';

// Isolated local Vite preview; never points to customer production or a live DB.
export default defineConfig({
  testDir:'./e2e',
  testMatch:'**/midnight.local.pw.mjs',
  timeout:60_000,
  expect:{timeout:10_000},
  workers:1,
  retries:0,
  reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report-midnight'}]],
  outputDir:'test-results-midnight',
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    headless:true,
    screenshot:'on',
    trace:'on',
  },
  webServer:{
    command:'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:30_000,
  }
});
