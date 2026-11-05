import {test,expect} from '@playwright/test';
// OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019: same-tenant owner-only SaaS billing scope.
// Prior case 018 checked foreign station; this one checks an unauthorized cashier IN s01b.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Only protected serial single-case workflow');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA secret not configured');
});
test(CASE+': same-station cashier cannot see or query owner plan @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errs=[],writes=[];
 page.on('pageerror',()=>errs.push('client_exception'));
 page.on('request',req=>{try{const url=new URL(req.url());
  if(url.origin===BASE&&url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
   writes.push([url.pathname,req.method()]);
 }catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-cashier');
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
 expect(scopes[0].role).toBe('cashier');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' CASHIER_AUTH_AND_SCOPE_PASS');
 const ownerPlanTile=page.locator('[data-ws-screen="overview"]:visible [data-ws-go="plan"]:visible');
 await expect(ownerPlanTile,'cashier must not see station owner Plan navigation').toHaveCount(0);
 console.log('QA_CASE '+CASE+' OWNER_PLAN_NAV_HIDDEN_PASS');
 const result=await page.request.get(BASE+'/api/station/billing/options?stationId='+STATION,{headers});
 const data=await result.json().catch(()=>({}));
 expect(result.status(),'cashier cannot read even their OWN station\'s owner-only billing quotes').toBe(403);
 expect(data).toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' SAME_SCOPE_CASHIER_BILLING_DENIED_PASS: 403');
 expect(writes).toEqual([]);
 expect(errs).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: CASHIER_AUTH_AND_SCOPE_PASS + OWNER_PLAN_NAV_HIDDEN_PASS + SAME_SCOPE_CASHIER_BILLING_DENIED_PASS + NO_WRITES');
});
