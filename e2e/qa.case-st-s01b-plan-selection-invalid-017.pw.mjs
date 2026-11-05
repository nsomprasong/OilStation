import {test,expect} from '@playwright/test';
// OS-QA-ST-PLAN-SELECTION-INVALID-017 — negative SaaS selection contract, real guarded API.
// No syntactically valid plan selection is ever sent; no plan, money, or billing writes.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PLAN-SELECTION-INVALID-017';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial one-case runner only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA protected secret unavailable');
});
test(CASE+': reject malformed billing plan requests without saving @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const errors=[],writes=[];
 page.on('pageerror',()=>errors.push('client_error'));
 page.on('request',req=>{
  try{const u=new URL(req.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')
   &&!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push([u.pathname,req.method()]);}catch{}
 });
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const session=JSON.parse(localStorage.getItem(key));if(session?.access_token)return session.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status()).toBe(200);
 const memberships=(await me.json()).memberships;
 expect(memberships).toHaveLength(1);
 expect(memberships[0].role).toBe('station_owner');
 expect(memberships[0].stationId).toBe(STATION);
 const optionsUrl=BASE+'/api/station/billing/options?stationId='+STATION;
 const read=async()=>{
  const r=await page.request.get(optionsUrl,{headers});
  expect(r.status(),'legitimate plan options must remain readable').toBe(200);
  return (await r.json()).result;
 };
 const initial=await read();
 const plan=initial.plans?.find(p=>p.id&&p.card&&p.promptpay);
 expect(plan,'require a real plan so malformed-input tests have valid surrounding context').toBeTruthy();
 console.log('QA_CASE '+CASE+' AUTH_AND_FIXTURE_PASS');

 const selectUrl=BASE+'/api/station/billing/select';
 const jsonHeaders={...headers,'content-type':'application/json'};
 const testReject=async(label,req,expectedStatus,expectedError)=>{
  const response=await req;
  const body=await response.json().catch(()=>({}));
  expect(response.status(),label+' should reject before any DB mutation').toBe(expectedStatus);
  expect(body.error,label+' should disclose only safe error code').toBe(expectedError);
  expect((await read()).selected,label+' must not change persisted selection').toEqual(initial.selected);
  console.log('QA_CASE '+CASE+' '+label+'_PASS: HTTP '+expectedStatus);
 };
 await testReject('DISALLOWED_PAYMENT',
  page.request.post(selectUrl,{headers:jsonHeaders,
   data:{stationId:STATION,planId:plan.id,paymentMethod:'bank_transfer'}}),
  400,'invalid_plan_selection');
 await testReject('FORGED_AMOUNT',
  page.request.post(selectUrl,{headers:jsonHeaders,
   data:{stationId:STATION,planId:plan.id,paymentMethod:'card',amountSatang:1}}),
  400,'invalid_plan_selection');
 await testReject('MALFORMED_PLAN_ID',
  page.request.post(selectUrl,{headers:jsonHeaders,
   data:{stationId:STATION,planId:'not-a-uuid',paymentMethod:'card'}}),
  400,'invalid_plan_selection');
 await testReject('MALFORMED_JSON',
  page.request.post(selectUrl,{headers:jsonHeaders,data:'{'}),
  400,'invalid_json');
 await testReject('CROSS_ORIGIN',
  page.request.post(selectUrl,{headers:{...jsonHeaders,origin:'https://untrusted.invalid'},
   data:{stationId:STATION,planId:plan.id,paymentMethod:'card'}}),
  403,'origin_forbidden');
 const finish=await read();
 expect(finish.selected).toEqual(initial.selected);
 expect(writes,'browser interaction must not send writes; API negative requests are isolated').toEqual([]);
 expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: FIVE_VALIDATION_GATES_PASS + NO_PERSISTENCE + NO_CLIENT_ERRORS');
});
