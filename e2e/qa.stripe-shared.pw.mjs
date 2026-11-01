import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
const LIVE='https://oilstation.goldensoft.cloud';
const UAT='https://oilstation-uat.nsomprasong.workers.dev';
const INVOICE='af6bd702-eecb-45da-b031-3039baaaca32';
const QA_AMOUNT=342400;
function qaOwnerPassword(){
 const root=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!root)throw Error('Missing QA-only owner credential source');
 return createHmac('sha256',root)
  .update('OilStation QA station role account 20261031/v1/s01a-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-STRIPE-PI-01 real Stripe TEST provider intent scoped to QA-S01-A only @qa-stripe-shared',
async({browser,request})=>{
 test.skip(process.env.OILSTATION_QA_STRIPE_PROVIDER_RUN!=='true',
  'Run only on approved, real Stripe TEST-mode UAT workflow');
 test.setTimeout(150000);
 const pre=await request.get(UAT+'/api/billing/payment-intent');
 expect(pre.status()).toBe(405);
 const page=await browser.newPage();
 try{
  await page.goto(LIVE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await page.locator('#qa-login-alias').fill('s01a-owner');
  await page.locator('#qa-login-password').fill(qaOwnerPassword());
  await page.locator('#qa-login-form button[type=submit]').click();
  await expect(page.locator('[data-ws-go="pump"]:visible').first())
   .toBeVisible({timeout:35000});
  const token=await page.evaluate(()=>{
   for(const key of Object.keys(localStorage)){
    if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
    try{return JSON.parse(localStorage.getItem(key))?.access_token||null;}catch{}
   }
   return null;
  });
  expect(token).toBeTruthy();
  const headers={authorization:'Bearer '+token,origin:UAT,'content-type':'application/json'};
  const bad=await page.request.post(UAT+'/api/billing/payment-intent',{
   headers,data:{invoiceId:'44444444-4444-4444-8444-444444444444',
     paymentMethod:'card'}});
  expect(bad.status()).toBe(403);
  const origin=await page.request.post(UAT+'/api/billing/payment-intent',{
   headers:{...headers,origin:'https://cross-origin.invalid'},
   data:{invoiceId:INVOICE,paymentMethod:'card'}});
  expect(origin.status()).toBe(403);
  const wrongMethod=await page.request.post(UAT+'/api/billing/payment-intent',{
   headers,data:{invoiceId:INVOICE,paymentMethod:'promptpay'}});
  expect(wrongMethod.status()).toBe(409);
  const create=await page.request.post(UAT+'/api/billing/payment-intent',{
   headers,data:{invoiceId:INVOICE,paymentMethod:'card'}});
  expect(create.status(),'QA Stripe PI should create in test-only UAT').toBe(200);
  const result=await create.json();
  expect(result.invoiceId).toBe(INVOICE);
  expect(result.paymentMethod).toBe('card');
  expect(result.clientSecret).toMatch(/^pi_[A-Za-z0-9]+_secret_/);
  const replay=await page.request.post(UAT+'/api/billing/payment-intent',{
   headers,data:{invoiceId:INVOICE,paymentMethod:'card'}});
  expect(replay.status()).toBe(200);
  const same=await replay.json();
  expect(same.clientSecret).toBe(result.clientSecret);
  expect(['requires_payment_method','requires_confirmation','processing']).toContain(same.status);
  console.log('QA-STRIPE-PI PASS: actual Stripe TEST PaymentIntent created and retrieved once, QA-S01-A invoice bound; no card confirmation, no settlement.');
 }finally{await page.close();}
});
