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

// Database evidence is fetched by the protected Node CI worker, NEVER Chromium.
// Business tables intentionally deny direct SELECT even to service_role; a
// read-only, QA-run-locked SECURITY DEFINER RPC exposes only the frozen fixtures.
// This function cannot create, update or delete any records.
async function snapshot() {
  const key = required('OILSTATION_QA_DB_KEY');
  if (!key.startsWith('sb_secret_') && key.split('.').length !== 3) {
    throw Error('QA DB credential must be a Supabase secret/service role key');
  }
  const headers = { 'apikey': key, 'content-type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.authorization = 'Bearer ' + key;
  const response = await fetch(DB + '/rest/v1/rpc/oilstation_qa_platform_evidence', {
    method: 'POST', headers,
    body: JSON.stringify({ p_qa_run_id: 'QA-20261031-PLATFORM-001' }),
  });
  if (!response.ok) {
    // Never include response body, credential, JWT or user data in CI logs.
    throw Error('QA-scoped evidence RPC unavailable: HTTP ' + response.status);
  }
  const evidence = await response.json();
  if (!evidence || !Array.isArray(evidence.stations) || !Array.isArray(evidence.users)) {
    throw Error('QA-scoped evidence RPC returned an invalid result');
  }
  return evidence;
}

function validateFixture(state, expectedCount) {
  const qaStations = state.stations;
  expect(state.unapprovedQaCount).toBe(0);
  expect(state.protectedStationCount).toBe(1);
  expect(state.allStationsCount).toBe(expectedCount + 1);
  expect(qaStations.length).toBe(expectedCount);
  expect(state.companiesCount).toBe(0); // Platform phase; never silently create customers
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
  expect((payload.stations || []).map(x => x.stationName).sort()).toEqual(expected.slice().sort());
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
      // Progressive Workspace intentionally hides its create form and its
      // functional tab until the user presses the visible "+" action.
      // Follow the real UI, never force DOM visibility or dispatch fake events.
      const addStation = page.locator('[data-ws-screen="stations"] > .os-add-fab');
      await expect(addStation).toBeVisible();
      await addStation.click();
      await expect(page.locator('#new-station-form')).toBeVisible();
      await page.locator('#org-name').fill('QA Organization S02-B');
      await page.locator('#station-name').fill('QA-S02-B');
      // Brand options load asynchronously after the Sales workspace mounts.
      // Verify the real authenticated API and wait for UI options to arrive,
      // without using sleeps, mocks or hardcoded unapproved brand codes.
      const brandsResponse = await page.request.get(BASE + '/api/fuel-brands', {
        headers: { authorization: 'Bearer ' + token }
      });
      expect(brandsResponse.status()).toBe(200);
      const brandsPayload = await brandsResponse.json();
      const allowedBrands = (brandsPayload.brands || []).map(x => x.code);
      expect(allowedBrands.length).toBeGreaterThan(0);
      const options = page.locator('#brand-select option:not([disabled])');
      await expect.poll(async () => options.count(), { timeout: 20_000 }).toBeGreaterThan(0);
      const visibleBrandOptions = await options.evaluateAll(items =>
        items.filter(x => x.value).map(x => x.value));
      expect(visibleBrandOptions.length).toBeGreaterThan(0);
      expect(allowedBrands).toContain(visibleBrandOptions[0]);
      await page.locator('#brand-select').selectOption(visibleBrandOptions[0]);
      await page.locator('#module-qr').check();
      await expect(page.locator('#new-station-form'))
        .toHaveAttribute('data-os-station-submit-ready', 'true');
      await expect(page.locator('#new-station-submit')).toBeEnabled();
      const invalidControls = await page.locator('#new-station-form').evaluate(form =>
        [...form.elements].filter(element => element.willValidate && !element.checkValidity())
          .map(element => element.id || element.name || 'unknown'));
      expect(invalidControls).toEqual([]);
      const createResponse = page.waitForResponse(r => r.url().endsWith('/api/platform/sales/create-station')
        && r.request().method() === 'POST');
      await page.locator('#new-station-submit').click();
      const created = await createResponse;
      expect(created.status()).toBe(201);
      const result = await created.json();
      expect(result.station?.stationName).toBe('QA-S02-B');
      const directoryTab = page.locator('[data-context-for="stations"] [data-os-pane-key="directory"]');
      await expect(directoryTab).toBeVisible();
      await directoryTab.click();
      await expect(page.locator('#station-count')).toBeVisible();
      await expect(page.locator('#station-count')).toContainText('2');
      await expect(page.locator('#station-list')).toBeVisible();
      await expect(page.locator('#station-list')).toContainText('QA-S02-B');
    }
    await ownStations(page, token, ['QA-S02-A', 'QA-S02-B']);
    await page.screenshot({ path: testInfo.outputPath('P-10-sales02.png'), animations: 'disabled' });
  } finally {
    await s02Context.close();
  }

  const after = await snapshot();
  validateFixture(after, 4);
  expect(after.allStationsCount).toBe(5);
  expect(after.requests.length).toBe(4);
  const s02b = after.stations.find(x => x.name === 'QA-S02-B');
  expect(s02b?.id).toBeTruthy();
  if (expected.length === 3) {
    expect(after.audit.filter(x => x.station_id === s02b.id)).toHaveLength(1);
    expect(after.allStationsCount - before.allStationsCount).toBe(1);
    expect(after.audit.length - before.audit.length).toBe(1);
  } else {
    expect(after.allStationsCount - before.allStationsCount).toBe(0);
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

// P-14/P-10: actual authenticated Chromium proves read-only Sales activity
// is populated and one Sales cannot read the other Sales' station or audit.
test('P-14 Sales own-activity and cross-tenant denial @sales-scope', async ({browser}, info)=>{
  test.skip(process.env.OILSTATION_QA_SALES_SCOPE_RUN!=='true',
    'Protected owner-triggered read-only QA only on main');
  required('OILSTATION_QA_SALES01_PASSWORD');
  required('OILSTATION_QA_SALES02_PASSWORD');
  const before=await snapshot();
  validateFixture(before,4);
  const station01=before.stations.find(x=>x.name==='QA-S01-A');
  const station02=before.stations.find(x=>x.name==='QA-S02-A');
  expect(station01?.id).toBeTruthy();
  expect(station02?.id).toBeTruthy();
  for(const [alias,own,other] of [['sales01',station01,station02],
                                  ['sales02',station02,station01]]){
    const context=await browser.newContext();
    try{
      const page=await context.newPage();
      const token=await login(page,alias);
      const headers={authorization:'Bearer '+token};
      const ownQuery=new URLSearchParams({stationId:own.id});
      const otherQuery=new URLSearchParams({stationId:other.id});
      const ownInspect=await page.request.get(BASE+'/api/platform/sales/inspection?'+ownQuery,{headers});
      expect(ownInspect.status()).toBe(200);
      const ownBody=(await ownInspect.json()).result;
      expect(ownBody?.readOnly).toBe(true);
      expect(ownBody?.station?.id).toBe(own.id);
      const ownActivity=await page.request.get(BASE+'/api/platform/sales/activity?'+ownQuery,{headers});
      expect(ownActivity.status()).toBe(200);
      const history=(await ownActivity.json()).result;
      expect(history?.readOnly).toBe(true);
      expect(history.events.length).toBeGreaterThan(0);
      expect(history.events.some(x=>x.what==='สร้างปั๊มน้ำมัน')).toBe(true);
      const blockedInspect=await page.request.get(BASE+'/api/platform/sales/inspection?'+otherQuery,{headers});
      expect(blockedInspect.status()).toBe(403);
      const blockedActivity=await page.request.get(BASE+'/api/platform/sales/activity?'+otherQuery,{headers});
      expect(blockedActivity.status()).toBe(403);
      const malformed=await page.request.get(BASE+'/api/platform/sales/activity?stationId=not-a-uuid',{headers});
      expect(malformed.status()).toBe(400);
      const wrongMethod=await page.request.post(BASE+'/api/platform/sales/activity?'+ownQuery,{headers,data:{}});
      expect(wrongMethod.status()).toBe(405);
      const tab=page.locator('[data-ws-go="activity"]:visible').first();
      await expect(tab).toBeVisible();
      await tab.click();
      const activityStatus=page.locator('#platform-sales-activity .os-activity-status');
      await expect(activityStatus).toContainText('แสดง');
      await expect(page.locator('#platform-sales-activity .os-activity-table tbody')).toContainText('สร้างปั๊มน้ำมัน');
      await page.screenshot({path:info.outputPath('P-14-'+alias+'-audit.png'),animations:'disabled'});
    }finally{await context.close();}
  }
  const after=await snapshot();
  expect(after.stations).toEqual(before.stations);
  expect(after.requests).toEqual(before.requests);
  expect(after.audit).toEqual(before.audit);
  expect(after.allStationsCount).toBe(5);
  expect(after.companiesCount).toBe(0);
});


/** P-04/P-15 read-only Role-Matrix guard: real Sales credentials, no writes.
 * Separate from the older station-creation test. Explicit opt-in from owner.
 */
test('P-04/P-15 Sales cannot access Admin/Support APIs on desktop or mobile @sales-guard',
 async ({browser},info)=>{
  test.skip(process.env.OILSTATION_QA_SALES_GUARD_RUN!=='true',
    'Only owner-approved protected one-shot Playwright on main');
  required('OILSTATION_QA_SALES01_PASSWORD');
  required('OILSTATION_QA_SALES02_PASSWORD');
  const before=await snapshot();
  validateFixture(before,4);
  const actors=[
   {alias:'sales01',own:['QA-S01-A','QA-S01-B']},
   {alias:'sales02',own:['QA-S02-A','QA-S02-B']}
  ];
  for(const actor of actors){
   const context=await browser.newContext({viewport:{width:1280,height:800}});
   try{
    const page=await context.newPage();
    const token=await login(page,actor.alias);
    const headers={authorization:'Bearer '+token};
    const who=await page.request.get(BASE+'/api/me',{headers});
    expect(who.status()).toBe(200);
    const profile=await who.json();
    expect(profile.memberships).toHaveLength(1);
    expect(profile.memberships[0].scopeType).toBe('platform');
    expect(profile.memberships[0].role).toBe('platform_sales');
    await ownStations(page,token,actor.own);

    // All of these are *GET only*; do not submit any privileged write.
    const forbidden=[
     '/api/qa/scopes',
     '/api/platform/stations',
     '/api/platform/billing/overview',
     '/api/platform/support/overview',
    ];
    for(const path of forbidden){
     const response=await page.request.get(BASE+path,{headers});
     expect(response.status(),actor.alias+' forbidden '+path).toBe(403);
    }
    for(const key of ['support','billing','finance','customers','hr','invitations','fuel']){
     await expect(page.locator('[data-ws-go="'+key+'"]'),
       actor.alias+' unauthorized UI '+key).toHaveCount(0);
    }
    await page.locator('[data-ws-go="stations"]:visible').first().click();
    await expect(page.locator('[data-ws-screen="stations"]')).toBeVisible();
    await expect(page.locator('#station-count')).toContainText('2');
    await page.screenshot({
     path:info.outputPath('P-04-'+actor.alias+'-desktop.png'),animations:'disabled'});

    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-ws-go="overview"]:visible').first().click();
    await expect(page.locator('[data-ws-screen="overview"]')).toBeVisible();
    for(const key of ['support','billing','finance','customers','hr','invitations','fuel']){
     await expect(page.locator('[data-ws-go="'+key+'"]')).toHaveCount(0);
    }
    await page.locator('[data-ws-go="stations"]:visible').first().click();
    await expect(page.locator('[data-ws-screen="stations"]')).toBeVisible();
    await expect(page.locator('#station-count')).toContainText('2');
    await page.screenshot({
     path:info.outputPath('P-04-'+actor.alias+'-mobile.png'),animations:'disabled'});
   }finally{await context.close();}
  }
  const after=await snapshot();
  expect(after.stations).toEqual(before.stations);
  expect(after.users).toEqual(before.users);
  expect(after.assignments).toEqual(before.assignments);
  expect(after.requests).toEqual(before.requests);
  expect(after.audit).toEqual(before.audit);
  expect(after.allStationsCount).toBe(5);
  expect(after.companiesCount).toBe(0);
});
