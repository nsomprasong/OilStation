import {test,expect} from '@playwright/test';

test('Post-deploy login matches forest/cream reference at six screen widths @public',async({page,request},info)=>{
 const css=await request.get('/oilstation.css');
 expect(css.status()).toBe(200);
 const source=await css.text();
 // Verify the deployed stylesheet, rather than the obsolete pre-November blue hero.
 for(const token of ['--auth-cream:#eae7df','--auth-deep:#0c1d17',
  'clip-path:polygon(0 0,73% 0,100% 100%,0 100%)'])
  expect(source).toContain(token);
 for(const width of [360,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:width>=1200?900:844});
  const response=await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);
  await expect(page.locator('.os-auth-frame')).toBeVisible();
  await expect(page.locator('.os-auth-hero')).toBeVisible();
  await expect(page.locator('.os-auth-card')).toBeVisible();
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await expect(page.locator('#qa-login-password')).toHaveAttribute('type','password');
  await expect(page.getByRole('button',{name:/สมัครสมาชิก|สร้างบัญชี/})).toHaveCount(0);
  const state=await page.evaluate(()=>{
   const hero=document.querySelector('.os-auth-hero');
   const frame=document.querySelector('.os-auth-frame');
   const form=document.querySelector('#qa-login-form');
   return {heroImage:getComputedStyle(hero).backgroundImage,
    clip:getComputedStyle(hero).clipPath,frameColor:getComputedStyle(frame).backgroundColor,
    buttonRadius:getComputedStyle(document.querySelector('#google')).borderTopLeftRadius,
    viewport:document.documentElement.clientWidth,
    width:document.documentElement.scrollWidth,
    formRect:form.getBoundingClientRect().toJSON()};
  });
  expect(state.heroImage).toContain('radial-gradient(');
  expect(state.clip).toContain('polygon(');
  expect(state.frameColor).toBe('rgb(234, 231, 223)');
  expect(state.buttonRadius).toBe('99px');
  expect(state.width,'horizontal overflow at '+width).toBeLessThanOrEqual(state.viewport+2);
  expect(state.formRect.x).toBeGreaterThanOrEqual(-1);
  expect(state.formRect.right).toBeLessThanOrEqual(state.viewport+2);
  await page.screenshot({path:info.outputPath('production-login-reference-'+width+'.png'),animations:'disabled'});
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
