import test from 'node:test';
import assert from 'node:assert/strict';
import {createBillingInvoiceApi} from '../../src/api/billing-invoices.mjs';
import {mountBillingWorkspace} from '../../src/client/billing.js';
import {readFileSync} from 'node:fs';
const U='11111111-1111-4111-8111-111111111111';
const ORG='22222222-2222-4222-8222-222222222222';
const url='https://oilstation.goldensoft.cloud/api/billing/invoices?organizationId='+ORG;
function app(forbidden=false){
 const calls=[];const handle=createBillingInvoiceApi({
  authenticate:async t=>t==='good'?{id:U}:null,
  db:{listSaasInvoices:async d=>{calls.push(d);
    if(forbidden)throw {code:'FORBIDDEN'};
    return [{status:'issued',amountSatang:27500}];}},
 });return {calls,handle};
}
test('invoice listing checks actor and org, station A cannot see station B',async()=>{
 const a=app();const res=await a.handle(new Request(url,{headers:{authorization:'Bearer good'}}));
 assert.equal(res.status,200);assert.equal((await res.json()).invoices[0].amountSatang,27500);
 assert.deepEqual(a.calls,[{actorId:U,organizationId:ORG}]);
 const b=app(true);
 assert.equal((await b.handle(new Request(url,{headers:{authorization:'Bearer good'}}))).status,403);
});
test('cannot pass arbitrary organization or spoof identity in query',async()=>{
 const a=app();
 assert.equal((await a.handle(new Request(url.replace(ORG,'bad'),{headers:{authorization:'Bearer good'}}))).status,400);
 assert.equal((await a.handle(new Request(url,{headers:{authorization:'Bearer bad'}}))).status,401);
 assert.equal(a.calls.length,0);
});
test('payment UI uses official Stripe.js and never accepts client amount overrides',()=>{
 assert.equal(typeof mountBillingWorkspace,'function');
 const body=readFileSync(new URL('../../src/client/billing.js',import.meta.url),'utf8');
 assert.match(body,/https:\/\/js\.stripe\.com\/v3\//);
 assert.match(body,/stripe\.confirmPayment/);
 assert.match(body,/invoiceId:invoice\.invoiceId,paymentMethod:invoice\.paymentMethod/);
 assert.match(body,/Stripe Webhook/);
 assert.doesNotMatch(body,/paymentIntent\.status\s*===\s*'succeeded'\s*\?\s*'paid'/);
});
