import {test,expect} from '@playwright/test';
// 012: even an authorized station owner cannot change a protected owner membership.
// Explicitly request the SAME role, so a defect cannot accidentally demote the owner.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PROTECTED-OWNER-CHANGE-DENIAL-012';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected QA one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA Secret unavailable');
});
test(CASE+': owner membership cannot be modified through member-change API @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errs=[];page.on('pageerror',()=>errs.push('client_error'));
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const t=JSON.parse(localStorage.getItem(key));if(t?.access_token)return t.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: s01b only');
 const dirUrl=BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION});
 const getOwner=async()=>{
  const response=await page.request.get(dirUrl,{headers});
  expect(response.status()).toBe(200);
  const members=(await response.json()).members;
  expect(members.filter(m=>m.active&&m.role==='station_owner')).toHaveLength(1);
  return members.find(m=>m.active&&m.role==='station_owner');
 };
 const owner=await getOwner();
 expect(owner.membershipId).toBeTruthy();
 const identity=owner.membershipId;
 console.log('QA_CASE '+CASE+' PROTECTED_FIXTURE_PASS: active owner role');
 const denied=await page.request.post(BASE+'/api/members/change',{
  headers:{...headers,'content-type':'application/json'},
  data:{membershipId:identity,action:'edit',roleCode:'station_owner'}
 });
 const body=await denied.json().catch(()=>({}));
 expect(denied.status(),'protected owner must reject even no-op edit').toBe(403);
 expect(body.error).toBe('permission_denied');
 console.log('QA_CASE '+CASE+' PROTECTED_ROLE_DENIED_PASS: 403 permission_denied');
 const after=await getOwner();
 expect(after.membershipId).toBe(identity);
 expect(after.role).toBe('station_owner');
 expect(after.active).toBe(true);
 expect(errs).toEqual([]);
 console.log('QA_CASE '+CASE+' UNCHANGED_PASS: owner remains protected and active');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + PROTECTED_FIXTURE_PASS + PROTECTED_ROLE_DENIED_PASS + UNCHANGED_PASS');
});
