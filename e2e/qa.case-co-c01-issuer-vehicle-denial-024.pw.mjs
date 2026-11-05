import {test,expect} from '@playwright/test';
// Fresh individual CASE-024, part of serial QA batch; no historical cases rerun.
// Negative authorization with intentionally nonexistent target UUID prevents valid writes.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-CO-ROLE-BOUNDARY-024';
const SCOPE='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','Protected new-case batch only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA secret unavailable');
});
test(CASE+': c01-issuer role boundary @qa-batch',async({page})=>{
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
 await page.locator('#qa-login-alias').fill('c01-issuer');
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
 expect(members[0].role).toBe('coupon_issuer');
 expect(members[0].scopeType).toBe('corporate_company');
 expect(members[0].corporateCompanyId).toBe(SCOPE);
 console.log('QA_CASE '+CASE+' AUTH_AND_SCOPE_PASS');
 await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first()).toBeVisible();
 
 const read=async()=>{
  const r=await page.request.get(BASE+'/api/corporate/drivers?companyId='+SCOPE,{headers});
  expect(r.status(),'issuer must read own company driver roster').toBe(200);
  const data=await r.json();
  expect(Array.isArray(data.drivers)).toBe(true);
  expect(data.drivers.length).toBeGreaterThan(0);
  return data.drivers;
 };
 const before=await read();
 console.log('QA_CASE '+CASE+' ISSUER_OWN_ROSTER_READ_PASS');
 const denied=await page.request.post(BASE+'/api/corporate/driver-vehicle',{
  headers:{...headers,origin:BASE,'content-type':'application/json'},
  data:{companyId:SCOPE,driverUserId:'00000000-0000-4000-8000-000000000024',plate:'QA 9024'},
 });
 expect(denied.status(),'issuer cannot assign corporate vehicle').toBe(403);
 expect(await denied.json()).toEqual({error:'permission_denied'});
 expect(await read(),'company driver roster must remain unchanged').toEqual(before);
 console.log('QA_CASE '+CASE+' ISSUER_VEHICLE_WRITE_DENIED_PASS: 403 + ROSTER_UNCHANGED');
 expect(uiWrites,'UI never sends API writes').toEqual([]);
 expect(errs,'no browser exceptions').toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_AND_SCOPE_PASS + ROLE_BOUNDARY_PASS + NO_UI_WRITES');
});
