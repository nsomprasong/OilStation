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

test('P-01-V invalid synthetic QA password rejected without session @public', async ({page,request},info)=>{
  // Intentional NEVER-EXISTED alias; no real username, real password or
  // approved actor is sent. Single invalid attempt, no account lockout loop.
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await page.locator('#qa-login-alias').fill('unknown-qa-20261031');
  await page.locator('#qa-login-password').fill('InvalidPassword2026!');
  await page.locator('#qa-login-form button[type="submit"]').click();
  await expect(page.locator('#notice')).toContainText('ชื่อผู้ใช้หรือรหัสผ่านทดสอบไม่ถูกต้อง');
  await expect(page.locator('#qa-login-form')).toBeVisible();
  const me=await request.get('/api/me');
  expect(me.status()).toBe(401);
  // Recovery must present a fresh guest login, not an unexpected session.
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await page.locator('#qa-login-password').fill('');
  await page.screenshot({path:info.outputPath('P-01-invalid-qa-login-recovery.png'),animations:'disabled'});
});


test('P-01-R guest Login responsive 360/390/430/1280 no horizontal clipping @public',
 async ({page,request},info)=>{
 const javascriptErrors=[];
 page.on('pageerror',e=>javascriptErrors.push(e.name));
 for(const width of [360,390,430,1280]){
  const height=width===1280?800:844;
  await page.setViewportSize({width,height});
  const response=await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  for(const selector of ['#google','#facebook','#qa-login-form',
   '#qa-login-alias','#qa-login-password']){
   await expect(page.locator(selector)).toBeVisible();
  }
  await expect(page.locator('#qa-login-password')).toHaveAttribute('type','password');
  const layout=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   page:document.documentElement.scrollWidth,
   form:document.querySelector('#qa-login-form')?.getBoundingClientRect().toJSON(),
  }));
  expect(layout.page, 'horizontal overflow at '+width+'px: '+JSON.stringify(layout))
   .toBeLessThanOrEqual(layout.viewport+1);
  expect(layout.form?.width,'login form rendered at '+width+'px').toBeGreaterThan(0);
  expect(layout.form.x,'form x at '+width+'px').toBeGreaterThanOrEqual(-1);
  expect(layout.form.right,'form right edge at '+width+'px')
   .toBeLessThanOrEqual(layout.viewport+1);
  await page.screenshot({path:info.outputPath('P-01-responsive-'+width+'.png'),animations:'disabled'});
 }
 expect(javascriptErrors).toEqual([]);
 const anon=await request.get('/api/me');
 expect(anon.status()).toBe(401);
});
