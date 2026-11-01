import test from 'node:test';
import assert from 'node:assert/strict';
import {createStripeTestPaymentIntents} from '../../src/adapters/stripe-test-payments.mjs';
import {createBillingPaymentApi} from '../../src/api/billing-payment.mjs';
import {createStripeWebhookApi} from '../../src/api/stripe-webhook.mjs';

const BASE='https://oilstation.goldensoft.cloud';
const ID='11111111-1111-4111-8111-111111111111';
const INVOICE='22222222-2222-4222-8222-222222222222';
const ATTEMPT='33333333-3333-4333-8333-333333333333';
const PI='pi_QABillingMock123456';
const AMOUNT=335552;
const WEBHOOK_SECRET='whsec_mock_billing_provider_contract_only';
const EVENT_ID='evt_QABillingMock123456';
const ts=1793523600;
function request(url,body,headers={}){
 return new Request(BASE+url,{method:'POST',headers:{
  'content-type':'application/json',authorization:'Bearer qa',origin:BASE,...headers},
  body:JSON.stringify(body)});
}
async function signed(event,valid=true){
 const body=JSON.stringify(event);
 const key=await crypto.subtle.importKey('raw',
  new TextEncoder().encode(WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=new TextEncoder().encode(ts+'.'+body);
 const digest=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,data))]
  .map(b=>b.toString(16).padStart(2,'0')).join('');
 return new Request(BASE+'/api/webhooks/stripe',{method:'POST',headers:{
  'content-type':'application/json','stripe-signature':'t='+ts+',v1='+
   (valid?digest:('0'.repeat(64)))},body});
}
test('simulated Stripe provider: locked invoice -> one PI -> signed webhook -> paid exactly once',async()=>{
 let providerCreates=0,providerReads=0,dbAttaches=0,paidTransitions=0;
 let storedPi=null,invoiceStatus='issued';
 const eventHashes=new Map();
 const paymentProvider=createStripeTestPaymentIntents(
  'sk_test_abcdefghijklmnop0123456789',{fetchImpl:async (url,opts)=>{
    assert.ok(url.startsWith('https://api.stripe.com/v1/payment_intents'));
    assert.match(opts.headers.authorization,/^Bearer sk_test_/);
    if(opts.method==='POST'){
      providerCreates++;
      const params=new URLSearchParams(opts.body);
      assert.equal(params.get('amount'),String(AMOUNT));
      assert.equal(params.get('currency'),'thb');
      assert.equal(params.get('payment_method_types[]'),'promptpay');
      assert.equal(params.get('metadata[saas_invoice_id]'),INVOICE);
      assert.equal(params.get('metadata[saas_payment_attempt_id]'),ATTEMPT);
      assert.equal(opts.headers['idempotency-key'],'oilstation-pi-'+ATTEMPT);
    }else{providerReads++;assert.ok(url.endsWith('/'+PI));}
    return new Response(JSON.stringify({id:PI,livemode:false,currency:'thb',
      amount:AMOUNT,client_secret:PI+'_secret_localmock',
      status:'requires_payment_method',
      metadata:{saas_invoice_id:INVOICE,saas_payment_attempt_id:ATTEMPT}}),{status:200});
  }});
 const db={
  prepareSaasPayment:async d=>{
    assert.equal(d.actorId,ID);assert.equal(d.invoiceId,INVOICE);
    assert.equal(d.paymentMethod,'promptpay');
    return {attemptId:ATTEMPT,amountSatang:AMOUNT,
     idempotencyKey:'oilstation-pi-'+ATTEMPT,paymentIntentId:storedPi};
  },
  attachSaasPaymentIntent:async d=>{
    assert.equal(d.paymentIntentId,PI);dbAttaches++;
    storedPi=PI;return {paymentIntentId:PI};
  },
  recordStripeEvent:async e=>{
    if(eventHashes.has(e.eventId)){
      assert.equal(eventHashes.get(e.eventId),e.hash);
      return {replayed:true};
    }
    eventHashes.set(e.eventId,e.hash);return {replayed:false};
  },
  reconcileSaasPaid:async proof=>{
    if(proof.paymentIntentId!==storedPi||proof.invoiceId!==INVOICE||
       proof.attemptId!==ATTEMPT||proof.amountSatang!==AMOUNT||
       proof.amountReceivedSatang!==AMOUNT||proof.currency!=='thb'||
       proof.livemode!==false)
      throw new Error('DB_TEST_PAYMENT_MISMATCH');
    if(invoiceStatus==='paid')return {status:'paid',replayed:true};
    invoiceStatus='paid';paidTransitions++;return {status:'paid',replayed:false};
  },
 };
 const billing=createBillingPaymentApi({authenticate:async t=>t==='qa'?{id:ID}:null,
    db,payments:paymentProvider,enabled:true});
 const once=await billing(request('/api/billing/payment-intent',
  {invoiceId:INVOICE,paymentMethod:'promptpay'}));
 assert.equal(once.status,200);
 assert.equal((await once.json()).clientSecret,PI+'_secret_localmock');
 const twice=await billing(request('/api/billing/payment-intent',
  {invoiceId:INVOICE,paymentMethod:'promptpay'}));
 assert.equal(twice.status,200);
 assert.equal(providerCreates,1);
 assert.equal(providerReads,1);
 assert.equal(dbAttaches,2);
 assert.equal(invoiceStatus,'issued');
 const hook=createStripeWebhookApi({db,secret:WEBHOOK_SECRET,nowSeconds:()=>ts,
  processTestPayments:true});
 const payment={object:'payment_intent',id:PI,livemode:false,
   currency:'thb',status:'succeeded',amount:AMOUNT,amount_received:AMOUNT,
   metadata:{saas_invoice_id:INVOICE,saas_payment_attempt_id:ATTEMPT}};
 const good={id:EVENT_ID,type:'payment_intent.succeeded',livemode:false,
   data:{object:payment}};
 assert.equal((await hook(await signed(good,false))).status,400);
 assert.equal(eventHashes.size,0);
 assert.equal((await hook(await signed({...good,data:{object:{
   ...payment,amount_received:AMOUNT-1}}}))).status,422);
 assert.equal(invoiceStatus,'issued');
 const signedOnce=await hook(await signed(good));
 assert.equal(signedOnce.status,200);
 assert.deepEqual(await signedOnce.json(),{received:true,replayed:false,invoiceStatus:'paid'});
 const signedTwice=await hook(await signed(good));
 assert.equal(signedTwice.status,200);
 assert.equal((await signedTwice.json()).replayed,true);
 assert.equal(paidTransitions,1);
 assert.equal(invoiceStatus,'paid');
 // Signed refunds are quarantined for manual reconciliation, never falsely ACKed.
 const refund=await hook(await signed({...good,id:'evt_QABillingRefund123456',
   type:'charge.refunded'}));
 assert.equal(refund.status,503);
 assert.equal(paidTransitions,1);
});
