import {test,expect} from '@playwright/test';
// 016: Station owner reads live SaaS plan options and switches payment quote only.
// Deliberately never clicks Save / Confirm, never creates Stripe charges/subscriptions.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PLAN-QUOTE-READONLY-016';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA Secret missing');
});
test(CASE+': station owner plan/payment quote stays read-only @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const writes=[],errs=[];
 page.on('pageerror',()=>errs.push('client_error'));
 page.on('request',req=>{
  try{const u=new URL(req.url());
   if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
    writes.push([u.pathname,req.method()]);
  }catch{}
 });
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
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status()).toBe(200);
 const scopes=(await me.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS');

 const optionsUrl=BASE+'/api/station/billing/options?stationId='+STATION;
 const getOptions=async()=>{
  const result=await page.request.get(optionsUrl,{headers});
  if(result.status()!==200)
   console.log('QA_CASE '+CASE+' API_BLOCKED: station billing options HTTP '+result.status());
  expect(result.status(),'real scoped station SaaS options required').toBe(200);
  return (await result.json()).result;
 };
 const api=await getOptions();
 expect(Array.isArray(api.plans)).toBe(true);
 expect(api.plans.length,'must have a configured SaaS plan to assess quote').toBeGreaterThan(0);
 const chosen=api.plans.find(p=>p.id&&p.card&&p.promptpay);
 expect(chosen,'a plan needs both supported payment quotes').toBeTruthy();
 const cardTotal=Number(chosen.card.totalSatang),qrTotal=Number(chosen.promptpay.totalSatang);
 expect(Number.isFinite(cardTotal)&&Number.isFinite(qrTotal)).toBe(true);
 expect(cardTotal).toBeGreaterThan(0);
 expect(qrTotal,'QR discount quote should be cheaper than card').toBeLessThan(cardTotal);
 console.log('QA_CASE '+CASE+' OPTIONS_PASS: scoped plans and discounted PromptPay quote');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="plan"]:visible').first();
 await expect(tile).toBeVisible({timeout:14000});
 await tile.click();
 const panel=page.locator('#station-saas-plan-workspace');
 const list=panel.locator('.owner-plan-list');
 await expect(list.locator('input[name="owner-plan"]')).toHaveCount(api.plans.length,{timeout:18000});
 const plan=list.locator('input[value="'+chosen.id+'"]');
 await expect(plan).toHaveCount(1);
 await plan.check();
 const payment=panel.locator('.owner-payment-methods');
 const quote=panel.locator('.owner-plan-quote');
 const card=payment.locator('input[value="card"]');
 const promptpay=payment.locator('input[value="promptpay"]');
 await expect(card).toHaveCount(1);
 await expect(promptpay).toHaveCount(1);
 await card.check();
 await expect(quote).toContainText('ยอดตามแพ็กเกจ');
 const cardText=await quote.innerText();
 await promptpay.check();
 await expect(quote).toContainText('ส่วนลด');
 await expect(quote).toContainText('VAT');
 await expect(quote).toContainText('ยอดตามแพ็กเกจ');
 const qrText=await quote.innerText();
 expect(qrText,'visible quote must update for cheaper PromptPay').not.toBe(cardText);
 expect(writes,'switching quotes must not create a billing write').toEqual([]);
 console.log('QA_CASE '+CASE+' QUOTE_UI_PASS: card and PromptPay choices update quote without Save');

 const after=await getOptions();
 expect(after.selected,'no plan/payment selection persisted').toEqual(api.selected);
 expect(writes).toEqual([]);
 expect(errs).toEqual([]);
 console.log('QA_CASE '+CASE+' NO_CHARGE_PASS: no selection POST, saved choice unchanged');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + OPTIONS_PASS + QUOTE_UI_PASS + NO_CHARGE_PASS + NO_WRITES');
});
