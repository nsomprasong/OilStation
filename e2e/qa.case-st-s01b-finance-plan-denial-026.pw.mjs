import {test,expect} from '@playwright/test';
// Fresh individual CASE-026, part of serial QA batch; no historical cases rerun.
// Negative authorization with intentionally nonexistent target UUID prevents valid writes.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-ROLE-BOUNDARY-026';
const SCOPE='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','Protected new-case batch only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA secret unavailable');
});
test(CASE+': s01b-finance role boundary @qa-batch',async({page})=>{
 test.setTimeout(105000);
 const errs=[],uiWrites=[];
 page.on('pageerror',()=>errs.push('js_exception'));
 page.on('request',req=>{try{
  const url=new URL(req.url());
  if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
    !['GET','HEAD','OPTIONS'].includes(req.method()))uiWrites.push([url.pathname,req.method()]);
 }catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-finance');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const sess=JSON.parse(localStorage.getItem(key));if(sess?.access_token)return sess.access_token;}catch{}
  }return null;
 });
 expect(token,'QA token').toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const members=(await who.json()).memberships;
 expect(members).toHaveLength(1);
 expect(members[0].role).toBe('finance_manager');
 expect(members[0].scopeType).toBe('station');
 expect(members[0].stationId).toBe(SCOPE);
 console.log('QA_CASE '+CASE+' AUTH_AND_SCOPE_PASS');
 await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="finance"]:visible').first()).toBeVisible();
 
 await expect(page.locator('[data-ws-go="plan"]')).toHaveCount(0);
 const options=await page.request.get(BASE+'/api/station/billing/options?stationId='+SCOPE,{headers});
 expect(options.status(),'owner-only billing GET denied').toBe(403);
 expect(await options.json()).toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' FINANCE_MANAGER_PLAN_READ_DENIED_PASS: 403');
 const denied=await page.request.post(BASE+'/api/station/billing/select',{
  headers:{...headers,origin:BASE,'content-type':'application/json'},
  data:{stationId:SCOPE,planId:'00000000-0000-4000-8000-000000000026',paymentMethod:'card'},
 });
 expect(denied.status(),'owner-only plan selection POST denied').toBe(403);
 expect(await denied.json()).toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' FINANCE_MANAGER_PLAN_WRITE_DENIED_PASS: 403');
 expect(uiWrites,'UI never sends API writes').toEqual([]);
 expect(errs,'no browser exceptions').toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_AND_SCOPE_PASS + ROLE_BOUNDARY_PASS + NO_UI_WRITES');
});
