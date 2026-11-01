import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedProjectQaStripeEligible,sharedProjectQaReconciliationEligible} from '../../src/domain/stripe-test-environment.mjs';
import {createSharedQaStripeApi} from '../../src/api/qa-stripe-shared.mjs';

const ref='cxihsotcpdnalswfoysx';
const station='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const run='QA-20261031-PLATFORM-001';
const actor='11111111-1111-4111-8111-111111111111';
const invoice='22222222-2222-4222-8222-222222222222';
const attempt='33333333-3333-4333-8333-333333333333';
const pi='pi_QAShared123456';
const secret='whsec_abcdefghijklmnopqrst';
const base='https://oilstation-uat.nsomprasong.workers.dev';
const env={
 OILSTATION_DEPLOY_TARGET:'uat',OILSTATION_API_ENABLED:'false',
 OILSTATION_SHARED_QA_BILLING_ENABLED:'true',
 OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_RUN_ID:run,
 OILSTATION_QA_STRIPE_STATION_ID:station,OILSTATION_SHARED_SUPABASE_REF:ref,
 SUPABASE_URL:'https://'+ref+'.supabase.co',STRIPE_TEST_PAYMENTS_ENABLED:'true',
 STRIPE_TEST_RECONCILIATION_ENABLED:'true',
 STRIPE_SECRET_KEY:'sk_test_abcdefghijklmnopqrst',
 STRIPE_PUBLISHABLE_KEY:'pk_test_abcdefghijklmnopqrst',
 STRIPE_WEBHOOK_SECRET:secret,
};
test('shared production project only works with API fully disabled and one QA UAT station',()=>{
 assert.equal(sharedProjectQaStripeEligible(env),true);
 assert.equal(sharedProjectQaReconciliationEligible(env),true);
 const forbidden=[
 {OILSTATION_DEPLOY_TARGET:'production'},
 {OILSTATION_API_ENABLED:'true'},
 {OILSTATION_API_ENABLED:undefined},
 {OILSTATION_SHARED_QA_BILLING_ENABLED:'false'},
 {OILSTATION_QA_MODE_ENABLED:'false'},
 {OILSTATION_QA_RUN_ID:'QA-20261031-OTHER-001'},
 {OILSTATION_QA_STRIPE_STATION_ID:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'},
 {OILSTATION_SHARED_SUPABASE_REF:'abcdefghijklmnopqrst'},
 {SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'},
 {STRIPE_SECRET_KEY:'sk_live_abcdefghijklmnopqrst'},
 {STRIPE_PUBLISHABLE_KEY:'pk_live_abcdefghijklmnopqrst'},
 {STRIPE_WEBHOOK_SECRET:''},
 {STRIPE_TEST_PAYMENTS_ENABLED:'false'},
 ];
 for(const variant of forbidden){
  assert.equal(sharedProjectQaStripeEligible({...env,...variant}),false,JSON.stringify(variant));
 }
 assert.equal(sharedProjectQaReconciliationEligible({...env,
   STRIPE_TEST_RECONCILIATION_ENABLED:'false'}),false);
});
const request=(data,auth='Bearer qa')=>new Request(base+'/api/billing/payment-intent',{
 method:'POST',headers:{authorization:auth,'content-type':'application/json',origin:base},
 body:JSON.stringify(data),
});
test('only authenticated QA actor with SQL-attested invoice can create PI (never arbitrary invoice)',async()=>{
 const calls=[];
 const deps={env,
 authenticate:async t=>t==='qa'?{id:actor,isQa:true}:{id:actor},
 db:{
  qaSaasInvoiceScope:async x=>{calls.push(['scope',x]);return x.invoiceId===invoice&&
    x.actorId===actor&&x.stationId===station&&x.qaRunId===run;},
  prepareSaasPayment:async x=>{calls.push(['prepare',x]);return {
    attemptId:attempt,amountSatang:335552,idempotencyKey:'oilstation-pi-'+attempt};},
  attachSaasPaymentIntent:async x=>{calls.push(['attach',x]);return {paymentIntentId:pi}},
 },
 payments:{create:async x=>{calls.push(['provider',x]);return {
  id:pi,clientSecret:pi+'_secret_test',status:'requires_payment_method'};}},
 };
 const handle=createSharedQaStripeApi(deps);
 const blocked=await handle(request({invoiceId:'44444444-4444-4444-8444-444444444444',paymentMethod:'card'}));
 assert.equal(blocked.status,403);assert.deepEqual(calls.map(x=>x[0]),['scope']);
 calls.length=0;
 const nonQa=await handle(request({invoiceId:invoice,paymentMethod:'card'},'Bearer notqa'));
 assert.equal(nonQa.status,401);assert.deepEqual(calls,[]);
 const ok=await handle(request({invoiceId:invoice,paymentMethod:'card'}));
 assert.equal(ok.status,200);assert.equal((await ok.json()).clientSecret,pi+'_secret_test');
 assert.deepEqual(calls.map(x=>x[0]),['scope','prepare','provider','scope','attach']);
 assert.equal(calls[0][1].actorId,actor);
});
test('Stripe webhook HMAC verified before SQL scope and quarantines any non-QA event',async()=>{
 const event={id:'evt_QAShared123456',type:'payment_intent.succeeded',livemode:false,
 data:{object:{id:pi,object:'payment_intent',livemode:false,status:'succeeded',
  currency:'thb',amount:335552,amount_received:335552,
  metadata:{saas_invoice_id:invoice,saas_payment_attempt_id:attempt}}}};
 let scopes=0,inbox=0,settlements=0;
 const handler=createSharedQaStripeApi({env,authenticate:async()=>null,db:{
  qaSaasInvoiceScope:async x=>{scopes++;return x.invoiceId===invoice&&x.actorId===null;},
  recordStripeEvent:async()=>{inbox++;return {replayed:false}},
  reconcileSaasPaid:async()=>{settlements++;return {status:'paid',replayed:false}},
 }});
 const ts=Math.floor(Date.now()/1000);
 async function signed(e,signature=true){
  const body=JSON.stringify(e);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const raw=new TextEncoder().encode(ts+'.'+body);
  const digest=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,raw))]
   .map(n=>n.toString(16).padStart(2,'0')).join('');
  return new Request(base+'/api/webhooks/stripe',{method:'POST',headers:{
   'content-type':'application/json','stripe-signature':'t='+ts+',v1='+
     (signature?digest:'0'.repeat(64))},body});
 }
 assert.equal((await handler(await signed(event,false))).status,400);
 assert.equal(scopes,0);assert.equal(inbox,0);
 const wrong={...event,data:{object:{...event.data.object,
  metadata:{...event.data.object.metadata,saas_invoice_id:'44444444-4444-4444-8444-444444444444'}}}};
 assert.equal((await handler(await signed(wrong))).status,403);
 assert.equal(inbox,0);assert.equal(settlements,0);
 const ok=await handler(await signed(event));
 assert.equal(ok.status,200);
 assert.equal(scopes,3);assert.equal(inbox,1);assert.equal(settlements,1);
 const refund=await handler(await signed({...event,id:'evt_QASharedRefund12',
  type:'charge.refunded'}));
 assert.equal(refund.status,403);assert.equal(inbox,1);
});
