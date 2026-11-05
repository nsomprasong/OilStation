import {test,expect} from '@playwright/test';
// 014: one QA station owner cannot read or write another station's fuel prices.
// Deliberately pair foreign stationId with the actor's OWN unchanged fuel row;
// even a broken permission check cannot alter the foreign station product.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-FUEL-CROSS-SCOPE-DENIAL-014';
const OWN='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const FOREIGN='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial single-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA Secret missing');
});
test(CASE+': s01b cannot read or change s01a fuel prices @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errors=[];page.on('pageerror',()=>errors.push('client_error'));
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const t=JSON.parse(localStorage.getItem(k));if(t?.access_token)return t.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const memberships=(await who.json()).memberships;
 expect(memberships).toHaveLength(1);
 expect(memberships[0].role).toBe('station_owner');
 expect(memberships[0].stationId).toBe(OWN);
 expect(FOREIGN).not.toBe(OWN);
 console.log('QA_CASE '+CASE+' AUTH_PASS: s01b only');

 const getOwn=async()=>{
  const response=await page.request.get(BASE+'/api/station-fuels?stationId='+OWN,{headers});
  expect(response.status()).toBe(200);
  const body=await response.json();
  expect(Array.isArray(body.fuels)).toBe(true);
  return body.fuels;
 };
 const before=await getOwn();
 const product=before.find(f=>f.id&&f.name);
 expect(product,'QA owner station has at least one actual fuel').toBeTruthy();
 const foreign=await page.request.get(BASE+'/api/station-fuels?stationId='+FOREIGN,{headers});
 const readBody=await foreign.json().catch(()=>({}));
 expect(foreign.status(),'unrelated station fuel catalog must not be readable').toBe(403);
 expect(readBody.error).toBe('permission_denied');
 console.log('QA_CASE '+CASE+' FOREIGN_READ_DENIED_PASS: 403');

 const validPrice=typeof product.publicPrice==='string'&&Number(product.publicPrice)>0
  ?product.publicPrice:'32.50';
 const denied=await page.request.post(BASE+'/api/station-fuel-config',{
  headers:{...headers,'content-type':'application/json'},
  data:{stationId:FOREIGN,stationFuelId:product.id,
    enabled:Boolean(product.enabled),publicPrice:validPrice}
 });
 const writeBody=await denied.json().catch(()=>({}));
 expect(denied.status(),'unrelated station fuel price must not be writable').toBe(403);
 expect(writeBody.error).toBe('permission_denied');
 console.log('QA_CASE '+CASE+' FOREIGN_WRITE_DENIED_PASS: 403');

 const after=await getOwn();
 const same=after.find(f=>f.id===product.id);
 expect(same,'QA owner fuel still exists').toBeTruthy();
 expect(same.publicPrice,'unchanged current station price').toEqual(product.publicPrice);
 expect(same.enabled,'unchanged availability').toEqual(product.enabled);
 expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' UNCHANGED_PASS: own QA price and enable remain the same');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + FOREIGN_READ_DENIED_PASS + FOREIGN_WRITE_DENIED_PASS + UNCHANGED_PASS');
});
