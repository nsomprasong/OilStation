import {test,expect} from '@playwright/test';

// 011: a station owner is allowed to manage staff but may never grant platform roles.
// One existing fictional QA staff member, one forbidden API POST, no accepted mutations.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-ROLE-ESCALATION-DENIAL-011';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const TARGET='65d3c545-59b3-4704-9f52-2133ec741e36';
const QA_EMAIL='qa-s01b-attendant@qa.oilstation.invalid';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial next-case only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA review Secret');
});
test(CASE+': station cannot grant platform role to QA staff @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const jsErrors=[];page.on('pageerror',()=>jsErrors.push('client_error'));
 const start=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(start?.status()).toBe(200);
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
 expect(memberships[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: only station owner');
 const url=BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION});
 const getTarget=async()=>{
  const response=await page.request.get(url,{headers});
  expect(response.status()).toBe(200);
  return (await response.json()).members.find(m=>m.membershipId===TARGET);
 };
 const before=await getTarget();
 expect(before,'exact fictional QA member must be present').toBeTruthy();
 expect(before.email).toBe(QA_EMAIL);
 expect(before.role).toBe('attendant');
 expect(before.active).toBe(true);
 console.log('QA_CASE '+CASE+' FIXTURE_PASS: known QA target and role verified');
 const refused=await page.request.post(BASE+'/api/members/change',{
  headers:{...headers,'content-type':'application/json'},
  data:{membershipId:TARGET,action:'edit',roleCode:'platform_superadmin'}
 });
 const reply=await refused.json().catch(()=>({}));
 expect(refused.status(),'station owner must not grant platform superadmin role').toBe(400);
 expect(reply.error).toBe('invalid_member_change');
 console.log('QA_CASE '+CASE+' ELEVATION_DENIED_PASS: role allowlist rejects platform role');
 const after=await getTarget();
 expect(after?.email).toBe(QA_EMAIL);
 expect(after?.role,'rejected write must not change existing role').toBe('attendant');
 expect(after.active).toBe(true);
 expect(jsErrors).toEqual([]);
 console.log('QA_CASE '+CASE+' UNCHANGED_PASS: QA staff role active and unchanged');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + FIXTURE_PASS + ELEVATION_DENIED_PASS + UNCHANGED_PASS');
});
