import test from 'node:test';
import assert from 'node:assert/strict';
import {createStripeTestPaymentIntents} from '../../src/adapters/stripe-test-payments.mjs';
import {createBillingPaymentApi} from '../../src/api/billing-payment.mjs';
const SECRET='sk_test_abcdefghijklmnop0123456789';
const U='11111111-1111-4111-8111-111111111111', I='22222222-2222-4222-8222-222222222222';
const A='33333333-3333-4333-8333-333333333333';
const PI='pi_ABCDEF123456';
const endpoint='https://oilstation.goldensoft.cloud/api/billing/payment-intent';
const mockStripe={id:PI,amount:27500,currency:'thb',metadata:{
 saas_invoice_id:I,saas_payment_attempt_id:A},livemode:false,
 client_secret:PI+'_secret_safetest',status:'requires_payment_method'};
test('Stripe adapter sends locked amount and test-only price snapshot metadata',async()=>{
 const calls=[];
 const s=createStripeTestPaymentIntents(SECRET,{fetchImpl:async (url,init)=>{
  calls.push({url,init});return new Response(JSON.stringify(mockStripe),{status:200});
 }});
 const result=await s.create({invoiceId:I,attemptId:A,amountSatang:27500,
  paymentMethod:'card',idempotencyKey:'oilstation-pi-'+A});
 assert.equal(result.clientSecret,mockStripe.client_secret);
 assert.equal(calls[0].init.headers['idempotency-key'],'oilstation-pi-'+A);
 const body=new URLSearchParams(calls[0].init.body);
 assert.equal(body.get('amount'),'27500');assert.equal(body.get('currency'),'thb');
 assert.equal(body.get('payment_method_types[]'),'card');
 assert.equal(body.get('metadata[saas_invoice_id]'),I);
 assert.equal(body.get('metadata[saas_payment_attempt_id]'),A);
});
test('test adapter rejects live secrets, amount mismatch and fabricated Stripe intents',async()=>{
 assert.throws(()=>createStripeTestPaymentIntents('sk_live_testing_abc'),/test_mode/);
 const s=createStripeTestPaymentIntents(SECRET,{fetchImpl:async()=>new Response(JSON.stringify({
 ...mockStripe,amount:10}),{status:200})});
 await assert.rejects(s.create({invoiceId:I,attemptId:A,amountSatang:27500,
  paymentMethod:'promptpay',idempotencyKey:'oilstation-pi-'+A}),/mismatch/);
});
const req=(body,headers={})=>new Request(endpoint,{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer good',...headers},
 body:JSON.stringify(body)});
function app(overrides={}){
 const calls=[];
 const handler=createBillingPaymentApi({enabled:true,authenticate:async t=>t==='good'?{id:U}:null,
 db:{
  prepareSaasPayment:async d=>{calls.push(['prepare',d]);return {
    attemptId:A,amountSatang:27500,idempotencyKey:'oilstation-pi-'+A}},
  attachSaasPaymentIntent:async d=>{calls.push(['attach',d]);return {paymentIntentId:PI}},
 },
 payments:{
  create:async d=>{calls.push(['stripe',d]);return {id:PI,clientSecret:PI+'_secret_token',status:'requires_payment_method'}},
  retrieve:async d=>{calls.push(['retrieve',d]);return {id:PI,clientSecret:PI+'_secret_token',status:'processing'}},
 },...overrides});
 return {calls,handler};
}
test('authenticated request has no user-controlled amount, amount derives solely from DB',async()=>{
 const a=app();const r=await a.handler(req({invoiceId:I,paymentMethod:'card'}));
 assert.equal(r.status,200);assert.match((await r.json()).clientSecret,/secret_token/);
 assert.deepEqual(a.calls.map(x=>x[0]),['prepare','stripe','attach']);
 assert.equal(a.calls[1][1].amountSatang,27500);
});
test('untrusted price and coupon wallet fields are rejected before any database access',async()=>{
 const a=app();
 for(const extra of [{amount:1},{amountSatang:1},{stationId:A},{wallet:true},{discount:0}]){
  assert.equal((await a.handler(req({invoiceId:I,paymentMethod:'card',...extra}))).status,400);
 }
 assert.equal(a.calls.length,0);
});
test('denied service, cross-origin requests, disabled test mode all fail closed',async()=>{
 const a=app();
 assert.equal((await a.handler(req({invoiceId:I,paymentMethod:'card'},{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await a.handler(req({invoiceId:I,paymentMethod:'card'},{authorization:'Bearer bad'}))).status,401);
 const d=app({enabled:false});
 assert.equal((await d.handler(req({invoiceId:I,paymentMethod:'card'}))).status,503);
 assert.equal(a.calls.length,0);
});
test('on retry, existing intent is retrieved instead of a second charge',async()=>{
 const a=app({db:{prepareSaasPayment:async()=>({
   attemptId:A,amountSatang:27500,idempotencyKey:'oilstation-pi-'+A,paymentIntentId:PI}),
  attachSaasPaymentIntent:async d=>({paymentIntentId:d.paymentIntentId})}});
 const r=await a.handler(req({invoiceId:I,paymentMethod:'card'}));
 assert.equal(r.status,200);assert.deepEqual(a.calls.map(x=>x[0]),['retrieve']);
});
