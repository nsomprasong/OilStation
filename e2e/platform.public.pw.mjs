import { test, expect } from '@playwright/test';

test('P-01 public QA login and API gate @public', async ({ page, request }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.name));
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await expect(page.locator('#qa-login-alias')).toBeVisible();
  await expect(page.locator('#qa-login-password')).toHaveAttribute('type', 'password');
  await page.screenshot({ path: testInfo.outputPath('P-01-public.png'), animations: 'disabled' });

  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe('ok');
  const unauthorized = await request.get('/api/me');
  expect(unauthorized.status()).toBe(401);
  expect((await unauthorized.json()).error).toBe('unauthenticated');
  const ownStations = await request.get('/api/platform/sales/stations');
  expect(ownStations.status()).toBe(401);
  expect((await ownStations.json()).error).toBe('unauthenticated');
  expect(errors).toEqual([]);
});

test('P-01 mobile guest login has functional fields @public', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await expect(page.locator('#qa-login-alias')).toBeVisible();
  await expect(page.locator('#qa-login-password')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('P-01-mobile.png'), animations: 'disabled' });
});

test('P-14 anonymous browser cannot inspect Platform Support @public', async ({ page, request }, testInfo) => {
  // Exercise the deployed Worker from REAL Chromium, not a mocked handler.
  const response = await page.goto('/api/platform/support/overview', {
    waitUntil: 'domcontentloaded'
  });
  expect(response?.status()).toBe(401);
  expect(JSON.parse(await page.locator('body').innerText()).error).toBe('unauthenticated');
  await page.screenshot({ path: testInfo.outputPath('P-14-support-denied.png') });

  // Rejects unknown query selectors and mutations before any data can be read or written.
  const unsupportedQuery = await request.get('/api/platform/support/overview?stationId=all');
  expect(unsupportedQuery.status()).toBe(400);
  const unsupportedMutation = await request.post('/api/platform/support/overview', { data: {} });
  expect(unsupportedMutation.status()).toBe(405);
});
