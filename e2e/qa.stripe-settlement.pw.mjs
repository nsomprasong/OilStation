import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// One fixed, already-issued, QA-only invoice; never a production customer charge.
// Stripe.js confirms with a Stripe test PaymentMethod, not a real card number.
const LIVE='https://oilstation.goldensoft.cloud';
const UAT='https://oilstation-uat.nsomprasong.workers.dev';
const INVOICE='af6bd702-eecb-45da-b031-3039baaaca32';
const PI='pi_3UWu3JGYSd2MkyFd2sC3ubZi';
function qaOrganizationOwnerPassword(){
 const root=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!root)throw Error('Missing protected QA credential');
 return createHmac('sha256',root)
  .update('OilStation QA station role account 20261031/v1/o01-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-STRIPE-SETTLEMENT-01 test card -> signed webhook -> invoice finalization @qa-stripe-settlement',
 async({browser,request})=>{
 test.skip(process.env.OILSTATION_QA_STRIPE_PROVIDER_RUN!=='true',
  'Runs only after guarded UAT deploy with protected GitHub QA identity');
 test.setTimeout(150000);
 const keyResponse=await request.get(UAT+'/api/qa/stripe/public-key');
 expect(keyResponse.status()).toBe(200);
 const {publishableKey}=await keyResponse.json();
 expect(publishableKey).toMatch(/^pk_test_[A-Za-z0-9_]{12,}$/);
 const page=await browser.newPage();
 try{
  await page.goto(LIVE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#qa-login-form')).toBeVisible();
  await page.locator('#qa-login-alias').fill('o01-owner');
  await page.locator('#qa-login-password').fill(qaOrganizationOwnerPassword());
  await page.locator('#qa-login-form button[type=submit]').click();
  await expect(page.locator('#qa-login-form')).toBeHidden({timeout:35000});
  const token=await page.evaluate(()=>{
   for(const key of Object.keys(localStorage)){
    if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
    try{return JSON.parse(localStorage.getItem(key))?.access_token||null;}catch{}
   }
   return null;
  });
  expect(token).toBeTruthy();
  const headers={authorization:'Bearer '+token,origin:UAT,'content-type':'application/json'};
  const body={invoiceId:INVOICE,paymentMethod:'card'};
  const start=await page.request.post(UAT+'/api/billing/payment-intent',{headers,data:body});
  expect(start.status(),'Frozen QA invoice must still be issued before confirmation').toBe(200);
  const payment=await start.json();
  expect(payment.clientSecret).toMatch(new RegExp('^'+PI+'_secret_'));
  expect(payment.status).toBe('requires_payment_method');
  await page.addScriptTag({url:'https://js.stripe.com/v3/'});
  const result=await page.evaluate(async({key,clientSecret})=>{
   const stripe=window.Stripe(key);
   const {paymentIntent,error}=await stripe.confirmCardPayment(clientSecret,{
    payment_method:'pm_card_visa'});
   return {status:paymentIntent?.status,id:paymentIntent?.id,
    amount:paymentIntent?.amount,currency:paymentIntent?.currency,
    error:error?{code:error.code,type:error.type,message:error.message}:null};
  },{key:publishableKey,clientSecret:payment.clientSecret});
  expect(result.error,'Stripe TEST card confirmation failed').toBeNull();
  expect(result.id).toBe(PI);
  expect(result.status).toBe('succeeded');
  expect(result.amount).toBe(342400);
  expect(result.currency).toBe('thb');
  // Once the signed webhook commits, starting this paid invoice must conflict.
  await expect.poll(async()=>{
   const check=await page.request.post(UAT+'/api/billing/payment-intent',{headers,data:body});
   return check.status();
  },{timeout:60000,intervals:[1500,2500,4000,6000]}).toBe(409);
  console.log('QA-STRIPE-SETTLEMENT PASS: real Stripe TEST card confirmed; signed webhook finalized the fixed QA invoice.');
 }finally{await page.close();}
});
