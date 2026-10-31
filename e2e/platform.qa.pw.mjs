import { test, expect } from '@playwright/test';

const BASE = 'https://oilstation.goldensoft.cloud';
const DB = 'https://cxihsotcpdnalswfoysx.supabase.co';
const FIXTURES = ['QA-S01-A', 'QA-S01-B', 'QA-S02-A', 'QA-S02-B'];
const QA_ALIAS = alias => 'qa-' + alias + '@qa.oilstation.invalid';

function required(name) {
  const value = process.env[name];
  if (!value) throw Error('Missing protected QA secret: ' + name);
  return value;
}

// Privileged DB evidence is fetched ONLY by the Node.js CI worker, never sent to Chromium.
// Read-only REST SELECTs; no use of the service key in page.evaluate, browser headers,
// screenshots, Playwright log output or the client application.
async function readRows(table, query) {
  const key = required('OILSTATION_QA_DB_KEY');
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.authorization = 'Bearer ' + key;
  const response = await fetch(DB + '/rest/v1/' + table + '?' + query, { headers });
  if (!response.ok) throw Error('DB evidence unavailable: ' + table + ' HTTP ' + response.status);
  return response.json();
}

async function snapshot() {
  const [stations, users, assignments, audit, requests, companies] = await Promise.all([
    readRows('stations', 'select=id,name,organization_id'),
    readRows('app_users', 'select=id,email'),
    readRows('sales_assignments', 'select=station_id,sales_user_id,effective_until'),
    readRows('audit_events', 'select=action,station_id,actor_id&action=eq.sales_station_created'),
    readRows('sales_station_creation_requests', 'select=actor_id,station_id,request_id'),
    readRows('corporate_companies', 'select=id'),
  ]);
  return { stations, users, assignments, audit, requests, companies };
}

function validateFixture(state, expectedCount) {
  const qaStations = state.stations.filter(s => s.name.startsWith('QA-'));
  expect(qaStations.length).toBe(expectedCount);
  expect(state.stations.length).toBe(expectedCount + 1); // existing production station is protected
  expect(state.companies.length).toBe(0); // Platform phase; never silently create customers
  const names = qaStations.map(s => s.name).sort();
  expect(names).toEqual(FIXTURES.slice(0, expectedCount).sort());
  const a = state.users.find(u => u.email === QA_ALIAS('sales01'));
  const b = state.users.find(u => u.email === QA_ALIAS('sales02'));
  expect(a?.id).toBeTruthy();
  expect(b?.id).toBeTruthy();
  for (const station of qaStations) {
    const assignment = state.assignments.filter(x => x.station_id === station.id && x.effective_until === null);
    expect(assignment).toHaveLength(1);
    expect(assignment[0].sales_user_id).toBe(station.name.startsWith('QA-S01') ? a.id : b.id);
    expect(state.requests.filter(x => x.station_id === station.id)).toHaveLength(1);
    expect(state.audit.filter(x => x.station_id === station.id && x.action === 'sales_station_created')).toHaveLength(1);
  }
  return {a,b};
}

async function login(page, alias) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await page.locator('#qa-login-alias').fill(alias);
  await page.locator('#qa-login-password').fill(required('OILSTATION_QA_' + alias.toUpperCase() + '_PASSWORD'));
  await page.locator('#qa-login-form button[type="submit"]').click();
  await expect(page.locator('[data-ws-go="stations"]:visible').first()).toBeVisible();
  // The token remains in the encrypted evidence only; NEVER log it.
  const token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (typeof value?.access_token === 'string') return value.access_token;
      } catch { /* continue */ }
    }
    return null;
  });
  expect(token).toBeTruthy();
  return token;
}

async function ownStations(page, token, expected) {
  const result = await page.request.get(BASE + '/api/platform/sales/stations', {
    headers: { authorization: 'Bearer ' + token }
  });
  expect(result.status()).toBe(200);
  const payload = await result.json();
  expect((payload.stations || []).map(x => x.name).sort()).toEqual(expected.slice().sort());
  return payload;
}

test('P-02/P-10 real Sales browser, API, Supabase and audit @auth', async ({ browser }, testInfo) => {
  if (process.env.OILSTATION_QA_AUTH_RUN !== 'true') {
    test.skip(true, 'Only protected workflow_dispatch on main may run authenticated QA');
  }
  required('OILSTATION_QA_SALES01_PASSWORD');
  required('OILSTATION_QA_SALES02_PASSWORD');
  const before = await snapshot();
  // Fail closed if any unexpected/duplicate/other-actor QA station exists.
  const existing = before.stations.filter(s => s.name.startsWith('QA-')).map(s => s.name);
  const expected = FIXTURES.slice(0, existing.includes('QA-S02-B') ? 4 : 3);
  expect(existing.slice().sort()).toEqual(expected.slice().sort());
  validateFixture(before, expected.length);

  const s02Context = await browser.newContext();
  const page = await s02Context.newPage();
  try {
    const token = await login(page, 'sales02');
    const preList = await ownStations(page, token, expected.length === 3
      ? ['QA-S02-A'] : ['QA-S02-A', 'QA-S02-B']);

    if (expected.length === 3) {
      if (process.env.OILSTATION_QA_ALLOW_CREATE !== 'true') {
        throw Error('QA-S02-B missing: authorized workflow must explicitly opt in to the one missing station creation');
      }
      await page.locator('[data-ws-go="stations"]:visible').first().click();
      await expect(page.locator('#new-station-form')).toBeVisible();
      await page.locator('#org-name').fill('QA Organization S02-B');
      await page.locator('#station-name').fill('QA-S02-B');
      const brands = await page.locator('#brand-select option').evaluateAll(options =>
        options.filter(x => x.value && !x.disabled).map(x => x.value));
      expect(brands.length).toBeGreaterThan(0);
      await page.locator('#brand-select').selectOption(brands[0]);
      await page.locator('#module-qr').check();
      const createResponse = page.waitForResponse(r => r.url().endsWith('/api/platform/sales/create-station')
        && r.request().method() === 'POST');
      await page.locator('#new-station-submit').click();
      const created = await createResponse;
      expect(created.status()).toBe(201);
      const result = await created.json();
      expect(result.station?.name).toBe('QA-S02-B');
      await expect(page.locator('#station-count')).toContainText('2');
      await expect(page.locator('#station-list')).toContainText('QA-S02-B');
    }
    await ownStations(page, token, ['QA-S02-A', 'QA-S02-B']);
    await page.screenshot({ path: testInfo.outputPath('P-10-sales02.png'), animations: 'disabled' });
  } finally {
    await s02Context.close();
  }

  const after = await snapshot();
  validateFixture(after, 4);
  expect(after.stations.length).toBe(5);
  expect(after.requests.length).toBe(4);
  const s02b = after.stations.find(x => x.name === 'QA-S02-B');
  expect(s02b?.id).toBeTruthy();
  if (expected.length === 3) {
    expect(after.audit.filter(x => x.station_id === s02b.id)).toHaveLength(1);
    expect(after.stations.length - before.stations.length).toBe(1);
    expect(after.audit.length - before.audit.length).toBe(1);
  } else {
    expect(after.stations.length - before.stations.length).toBe(0);
  }

  const s01Context = await browser.newContext();
  try {
    const page01 = await s01Context.newPage();
    const sales01Token = await login(page01, 'sales01');
    await ownStations(page01, sales01Token, ['QA-S01-A', 'QA-S01-B']);
    const unauthorized = await page01.request.get(BASE + '/api/platform/sales/stations');
    expect(unauthorized.status()).toBe(401);
    await page01.screenshot({ path: testInfo.outputPath('P-10-sales01.png'), animations: 'disabled' });
  } finally {
    await s01Context.close();
  }
  // No destructive cleanup. No third-station create attempt against production.
});
