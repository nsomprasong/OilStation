import {test,expect} from '@playwright/test';
// OS-QA-ST-PLAN-CASHIER-WRITE-DENIAL-020: forbidden same-station plan SELECT POST.
// Distinct from 019 (GET denial). A deliberately non-existent plan UUID guarantees
// that even a defective authorization layer cannot save a valid plan selection.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PLAN-CASHIER-WRITE-DENIAL-020';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const INVALID_BUT_WELL_FORMED_PLAN='00000000-0000-4000-8000-000000000020';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Only protected one-case serial runner');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA secret');
});
test(CASE+': cashier forbidden from POST selecting owner plan @qa-one-case',async({browser})=>{
 test.setTimeout(105000);
 const errors=[],browserWrites=[];
 async function logIn(alias,expectedRole){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  page.on('pageerror',()=>errors.push('javascript_exception'));
  page.on('request',req=>{try{
   const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
       !['GET','HEAD','OPTIONS'].includes(req.method()))browserWrites.push([alias,url.pathname,req.method()]);
  }catch{}});
  expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
  await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
  await page.locator('#qa-login-alias').fill(alias);
  await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
  await page.locator('#qa-login-form button[type="submit"]').click();
  await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
  const token=await page.evaluate(()=>{
   for(const key of Object.keys(localStorage)){
    if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
    try{const auth=JSON.parse(localStorage.getItem(key));if(auth?.access_token)return auth.access_token;}catch{}
   }return null;
  });
  expect(token,'protected QA token must be available').toBeTruthy();
  const headers={authorization:'Bearer '+token};
  const who=await page.request.get(BASE+'/api/me',{headers});
  expect(who.status()).toBe(200);
  const scopes=(await who.json()).memberships;
  expect(scopes).toHaveLength(1);
  expect(scopes[0].role).toBe(expectedRole);
  expect(scopes[0].stationId).toBe(STATION);
  return {context,page,headers};
 }
 const owner=await logIn('s01b-owner','station_owner');
 const optionsUrl=BASE+'/api/station/billing/options?stationId='+STATION;
 const readSelected=async()=>{
  const response=await owner.page.request.get(optionsUrl,{headers:owner.headers});
  expect(response.status(),'owner-only snapshot read must succeed').toBe(200);
  return (await response.json()).result;
 };
 const before=await readSelected();
 expect(Array.isArray(before.plans)).toBe(true);
 expect(before.plans.some(plan=>plan.id===INVALID_BUT_WELL_FORMED_PLAN),
   'non-existent plan guard must not accidentally refer to a visible real plan').toBe(false);
 console.log('QA_CASE '+CASE+' OWNER_BASELINE_READ_PASS');
 const cashier=await logIn('s01b-cashier','cashier');
 console.log('QA_CASE '+CASE+' CASHIER_AUTH_AND_SCOPE_PASS');
 // Test the write permission itself, not a malformed-body validation error.
 // The UUID is syntactically valid but cannot correspond to a real offered plan;
 // even if authorization regresses, pricing should fail BEFORE checkout persistence.
 const denied=await cashier.page.request.post(BASE+'/api/station/billing/select',{
  headers:{...cashier.headers,'content-type':'application/json'},
  data:{stationId:STATION,planId:INVALID_BUT_WELL_FORMED_PLAN,paymentMethod:'card'},
 });
 const deniedData=await denied.json().catch(()=>({}));
 expect(denied.status(),'cashier must be denied before any plan lookup').toBe(403);
 expect(deniedData,'no private pricing information may leak').toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' CASHIER_PLAN_SELECT_WRITE_DENIED_PASS: 403');
 const after=await readSelected();
 expect(after.selected,'checkout selection must remain unchanged').toEqual(before.selected);
 console.log('QA_CASE '+CASE+' OWNER_PERSISTED_SELECTION_UNCHANGED_PASS');
 expect(browserWrites,'UI must not initiate any accidental API write').toEqual([]);
 expect(errors,'no browser client-side exceptions').toEqual([]);
 await cashier.context.close();
 await owner.context.close();
 console.log('QA_CASE '+CASE+' RESULT: OWNER_BASELINE_READ_PASS + CASHIER_AUTH_AND_SCOPE_PASS + CASHIER_PLAN_SELECT_WRITE_DENIED_PASS + OWNER_PERSISTED_SELECTION_UNCHANGED_PASS + NO_UI_WRITES');
});
