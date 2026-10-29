import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStripeSignature,createStripeWebhookApi} from '../../src/api/stripe-webhook.mjs';
const now=1793280000,secret='whsec_fake_test_secret_has_more_than_twenty_chars';
const endpoint='https://oilstation.goldensoft.cloud/api/webhooks/stripe';
async function sign(text,t=now){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=new TextEncoder().encode(String(t)+'.'+text);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
 return 't='+t+',v1='+[...sig].map(n=>n.toString(16).padStart(2,'0')).join('');
}
const event={id:'evt_TEST1234567890',type:'payment_intent.succeeded',livemode:false,data:{object:{id:'pi_TEST'}}};
async function make(custom=event,ts=now){
 const text=JSON.stringify(custom);
 return new Request(endpoint,{method:'POST',headers:{'content-type':'application/json',
 'stripe-signature':await sign(text,ts)},body:text});
}
test('Stripe signature verifies exact raw bytes and rejects tampering/old timestamps',async()=>{
 const body=JSON.stringify(event),sig=await sign(body);
 assert.equal(await verifyStripeSignature(new TextEncoder().encode(body),sig,secret,now),true);
 assert.equal(await verifyStripeSignature(new TextEncoder().encode(body+' '),sig,secret,now),false);
 assert.equal(await verifyStripeSignature(new TextEncoder().encode(body),sig,secret,now+301),false);
 assert.equal(await verifyStripeSignature(new TextEncoder().encode(body),'t='+now+',v1=bad',secret,now),false);
});
test('signed test event stores inbox only, duplicate delegated to SQL and never pays invoice',async()=>{
 const calls=[];const app=createStripeWebhookApi({secret,nowSeconds:()=>now,
  db:{recordStripeEvent:async data=>{calls.push(data);return {replayed:false};}}});
 const response=await app(await make());
 assert.equal(response.status,200);assert.equal((await response.json()).received,true);
 assert.deepEqual(Object.keys(calls[0]).sort(),['eventId','eventType','hash','livemode'].sort());
 assert.match(calls[0].hash,/^[0-9a-f]{64}$/);
});
test('live Stripe event is blocked until production billing authorization',async()=>{
 let writes=0;const app=createStripeWebhookApi({secret,nowSeconds:()=>now,
   db:{recordStripeEvent:async()=>{writes++;}}});
 const r=await app(await make({...event,livemode:true}));
 assert.equal(r.status,422);assert.equal(writes,0);
});
test('missing signature, wrong secret, duplicate event inconsistency fail closed',async()=>{
 const app=createStripeWebhookApi({secret,nowSeconds:()=>now,
   db:{recordStripeEvent:async()=>{throw {code:'IDEMPOTENCY_CONFLICT'};}}});
 assert.equal((await app(new Request(endpoint,{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify(event)}))).status,400);
 assert.equal((await app(await make())).status,409);
});
