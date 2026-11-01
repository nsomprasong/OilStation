import {test,expect} from '@playwright/test';

test('CSS v2 deployed guest layout at six screen widths @public',async({page,request})=>{
 const css=await request.get('/oilstation.css');
 expect(css.status()).toBe(200);
 const source=await css.text();
 for(const token of ['--os-bg:#060F33','--os-side:#040B28','--os-card:#0E1B47'])
  expect(source).toContain(token);
 for(const width of [360,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:width>=1200?900:844});
  const response=await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  await expect(page.locator('.os-auth-hero')).toBeVisible();
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  const result=await page.evaluate(()=>{
   const hero=document.querySelector('.os-auth-hero');
   return {color:getComputedStyle(hero).backgroundColor,
    viewport:document.documentElement.clientWidth,
    width:document.documentElement.scrollWidth};
  });
  expect(result.color).toBe('rgb(4, 11, 40)');
  expect(result.width).toBeLessThanOrEqual(result.viewport+2);
 }
});
test('HR advance and payee read routes remain private on live Worker @public',async({request})=>{
 for(const pathname of ['/api/hr/payees','/api/hr/advances',
 '/api/hr/advances/period-preview','/api/hr/advances/manual-confirmations']){
  const res=await request.get(pathname);
  expect([401,403,404,503]).toContain(res.status());
  expect((await res.json()).error).toEqual(expect.any(String));
 }
 const result=await request.get('/api/billing/payment-intent');
 expect(result.status()).toBe(503);
 expect((await result.json()).error).toBe('release_not_enabled');
});
