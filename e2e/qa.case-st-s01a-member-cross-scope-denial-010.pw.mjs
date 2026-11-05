import {test,expect} from '@playwright/test';
// Case 010: cross-station membership change must be denied at trusted API.
// The targeted requested role equals its current role to make bypass non-privilege-changing.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-CROSS-SCOPE-DENIAL-010';
const SOURCE='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const OTHER='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const OTHER_MEMBER='65d3c545-59b3-4704-9f52-2133ec741e36';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Only serial protected QA');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA Secret missing');
});
test(CASE+': s01a owner cannot change s01b synthetic member @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errs=[];
 page.on('pageerror',()=>errs.push('client_error'));
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01a-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(k));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(SOURCE);
 expect(scopes[0].stationId).not.toBe(OTHER);
 console.log('QA_CASE '+CASE+' AUTH_PASS: s01a only, not target s01b');
 const request=await page.request.post(BASE+'/api/members/change',{
  headers:{...headers,'content-type':'application/json'},
  data:{membershipId:OTHER_MEMBER,action:'edit',roleCode:'attendant'}
 });
 const result=await request.json().catch(()=>({}));
 expect(request.status(),'forged cross-tenant role change must be denied').toBe(403);
 expect(result.error).toBe('permission_denied');
 console.log('QA_CASE '+CASE+' CROSS_SCOPE_WRITE_DENIED_PASS: 403 permission_denied');
 const listing=await page.request.get(BASE+'/api/members/directory?'+
  new URLSearchParams({scopeType:'station',scopeId:OTHER}),{headers});
 const directory=await listing.json().catch(()=>({}));
 expect(listing.status(),'cross-scope member directory must not be readable').toBe(403);
 expect(directory.error).toBe('permission_denied');
 console.log('QA_CASE '+CASE+' CROSS_SCOPE_READ_DENIED_PASS: 403 permission_denied');
 expect(errs).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + CROSS_SCOPE_WRITE_DENIED_PASS + CROSS_SCOPE_READ_DENIED_PASS');
});
