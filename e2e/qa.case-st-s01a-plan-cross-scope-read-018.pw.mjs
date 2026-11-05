import {test,expect} from '@playwright/test';
// OS-QA-ST-PLAN-CROSS-SCOPE-READ-018: one previously untested billing scope guard.
// Read-only: s01a owner must not see s01b private plan/selection data.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PLAN-CROSS-SCOPE-READ-018';
const OWN_STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const FOREIGN_STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected single-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA review secret');
});
test(CASE+': foreign station SaaS details forbidden @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errs=[],clientWrites=[];
 page.on('pageerror',()=>errs.push('javascript_exception'));
 page.on('request',r=>{
  try{const u=new URL(r.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')
   &&!['GET','HEAD','OPTIONS'].includes(r.method()))clientWrites.push([u.pathname,r.method()]);}catch{}
 });
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01a-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const auth=JSON.parse(localStorage.getItem(key));if(auth?.access_token)return auth.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(OWN_STATION);
 expect(scopes[0].stationId).not.toBe(FOREIGN_STATION);
 console.log('QA_CASE '+CASE+' AUTH_AND_SCOPE_PASS: owner belongs only to s01a');
 const endpoint=id=>BASE+'/api/station/billing/options?stationId='+id;
 const own=await page.request.get(endpoint(OWN_STATION),{headers});
 expect(own.status(),'billing options must be available for owned station').toBe(200);
 expect(Array.isArray((await own.json()).result?.plans)).toBe(true);
 console.log('QA_CASE '+CASE+' OWN_STATION_READ_PASS');
 const foreign=await page.request.get(endpoint(FOREIGN_STATION),{headers});
 const denied=await foreign.json().catch(()=>({}));
 expect(foreign.status(),'foreign billing data should be inaccessible').toBe(403);
 expect(denied,'response must not expose private billing data').toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' CROSS_SCOPE_READ_DENIED_PASS: 403, no private plan details');
 const noAuth=await page.request.get(endpoint(FOREIGN_STATION));
 expect(noAuth.status(),'foreign billing data without auth must be inaccessible').toBe(401);
 expect(await noAuth.json()).toEqual({error:'unauthenticated'});
 console.log('QA_CASE '+CASE+' UNAUTHENTICATED_DENIED_PASS: 401');
 const ownAgain=await page.request.get(endpoint(OWN_STATION),{headers});
 expect(ownAgain.status()).toBe(200);
 expect(clientWrites).toEqual([]);
 expect(errs).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_AND_SCOPE_PASS + OWN_STATION_READ_PASS + CROSS_SCOPE_READ_DENIED_PASS + UNAUTHENTICATED_DENIED_PASS + NO_WRITES');
});
