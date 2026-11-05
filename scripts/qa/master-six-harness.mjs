import {test,expect} from '@playwright/test';

// Shared protected browser scaffold; each new spec still declares a literal
// MASTER_UAT_ID and contains its own independent real acceptance assertions.
export const BASE='https://oilstation.goldensoft.cloud';
export const STATION_A='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
export const STATION_B='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
export const STATION_S02A='24dc4981-0e6f-4b86-bfd7-03717002d0be';
export const STATION_S02B='02183a4e-47b0-4575-9f4f-74cec6553205';
export const COMPANY_C01='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';

export async function qaLogin(page,alias,role=null,scopeType=null,scopeId=null) {
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const a=JSON.parse(localStorage.getItem(k));if(a?.access_token)return a.access_token;}catch{}
  }return null;
 });
 expect(token,'existing QA session bearer').toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status(),'real /api/me verified').toBe(200);
 const membership=(await me.json()).memberships;
 expect(membership).toHaveLength(1);
 if(role)expect(membership[0].role,'QA role').toBe(role);
 if(scopeType)expect(membership[0].scopeType,'QA scope type').toBe(scopeType);
 if(scopeId)expect(membership[0][scopeType==='station'?'stationId':scopeType==='corporate_company'?'corporateCompanyId':scopeType==='organization'?'organizationId':'userId'],'QA scope id').toBe(scopeId);
 return {token,headers,membership:membership[0]};
}
export function masterCase({id,alias=null,role=null,scopeType=null,scopeId=null,description,check}){
 test('MASTER '+id+' '+description+' @qa-master-six',async({page})=>{
  test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','Protected Master UAT batch only');
  if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA review Secret unavailable');
  test.setTimeout(110000);
  const errors=[],uiWrites=[];
  page.on('pageerror',()=>errors.push('javascript_exception'));
  page.on('request',req=>{try{
   const u=new URL(req.url());
   if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
    uiWrites.push([u.pathname,req.method()]);
  }catch{}});
  const home=await page.goto(BASE,{waitUntil:'domcontentloaded'});
  expect(home?.status()).toBe(200);
  let auth=null;
  if(alias)auth=await qaLogin(page,alias,role,scopeType,scopeId);
  console.log('MASTER_CASE '+id+' LOGIN_AND_SCOPE_PASS');
  await check({page,auth,headers:auth?.headers||{},expect,BASE});
  expect(uiWrites,'No unintended browser UI finance/station mutations').toEqual([]);
  expect(errors,'No unexpected browser JS exception').toEqual([]);
  console.log('MASTER_CASE '+id+' RESULT: BOUNDED_ASSERTIONS_PASS + ZERO_UI_WRITES');
 });
}
