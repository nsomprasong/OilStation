import {test,expect} from '@playwright/test';
// OS-QA-CO-DRIVER-VEHICLE-WRITE-DENIAL-022: one new role-boundary POST check.
// A deliberately nonexistent driver UUID prevents a valid write on any auth regression.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-CO-DRIVER-VEHICLE-WRITE-DENIAL-022';
const COMPANY='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
const NONEXISTENT_DRIVER='00000000-0000-4000-8000-000000000022';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Only protected one-case serial workflow');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA review secret');
});
test(CASE+': same-company driver cannot assign vehicle @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errors=[],uiWrites=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',req=>{try{
  const u=new URL(req.url());
  if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
   uiWrites.push([u.pathname,req.method()]);
 }catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('c01-driver');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const auth=JSON.parse(localStorage.getItem(key));
    if(auth?.access_token)return auth.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status()).toBe(200);
 const memberships=(await me.json()).memberships;
 expect(memberships).toHaveLength(1);
 expect(memberships[0].role).toBe('driver');
 expect(memberships[0].scopeType).toBe('corporate_company');
 expect(memberships[0].corporateCompanyId).toBe(COMPANY);
 console.log('QA_CASE '+CASE+' DRIVER_AUTH_AND_SCOPE_PASS');
 await expect(page.locator('[data-ws-go="corporate"]')).toHaveCount(0);
 const driverTile=page.locator('[data-ws-screen="overview"] [data-ws-go="driver"]:visible').first();
 await expect(driverTile).toBeVisible();
 await driverTile.click();
 await expect(page.locator('[data-ws-screen="driver"]:visible')).toBeVisible();
 await expect(page.locator('#driver-workspace:visible')).toBeVisible();
 console.log('QA_CASE '+CASE+' DRIVER_ONLY_WORKSPACE_PASS');
 const readOwn=async()=>{
  const res=await page.request.get(BASE+'/api/driver/coupons',{headers});
  expect(res.status(),'driver inbox GET').toBe(200);
  const data=await res.json();
  expect(Array.isArray(data.vehicles)).toBe(true);
  expect(Array.isArray(data.coupons)).toBe(true);
  return data;
 };
 const before=await readOwn();
 expect(before.vehicles.length,'fixed QA driver vehicle').toBeGreaterThan(0);
 const denied=await page.request.post(BASE+'/api/corporate/driver-vehicle',{
  headers:{...headers,origin:BASE,'content-type':'application/json'},
  data:{companyId:COMPANY,driverUserId:NONEXISTENT_DRIVER,plate:'QA 9022'},
 });
 const data=await denied.json().catch(()=>({}));
 expect(denied.status(),'driver cannot assign vehicles').toBe(403);
 expect(data,'no confidential data in permission denial').toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' DRIVER_VEHICLE_POST_DENIED_PASS: 403');
 const after=await readOwn();
 expect(after.vehicles,'own vehicle assignment unchanged').toEqual(before.vehicles);
 expect(after.coupons,'own coupons unchanged').toEqual(before.coupons);
 expect(uiWrites,'no browser UI mutations').toEqual([]);
 expect(errors,'no browser exceptions').toEqual([]);
 console.log('QA_CASE '+CASE+' DRIVER_INBOX_UNCHANGED_PASS + NO_UI_WRITES');
 console.log('QA_CASE '+CASE+' RESULT: DRIVER_AUTH_AND_SCOPE_PASS + DRIVER_ONLY_WORKSPACE_PASS + DRIVER_VEHICLE_POST_DENIED_PASS + DRIVER_INBOX_UNCHANGED_PASS + NO_UI_WRITES');
});
