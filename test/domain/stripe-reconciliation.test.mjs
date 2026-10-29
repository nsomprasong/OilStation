import test from 'node:test';
import assert from 'node:assert/strict';
import {paidStripeEvidence} from '../../src/domain/stripe-reconciliation.mjs';
const I='11111111-1111-4111-8111-111111111111';
const A='22222222-2222-4222-8222-222222222222';
const raw={id:'evt_ABCDEF123456',type:'payment_intent.succeeded',livemode:false,
 data:{object:{id:'pi_ABCDEF123456',object:'payment_intent',livemode:false,
 currency:'thb',status:'succeeded',amount:27500,amount_received:27500,
 metadata:{saas_invoice_id:I,saas_payment_attempt_id:A}}}};
test('signed test PaymentIntent success evidence includes locked Stripe references',()=>{
 assert.deepEqual(paidStripeEvidence(raw),{
 eventId:raw.id,paymentIntentId:raw.data.object.id,invoiceId:I,attemptId:A,
 amountSatang:27500,amountReceivedSatang:27500,currency:'thb',
 status:'succeeded',livemode:false,
 });
});
test('only succeeded test PI is eligible; invalid paid claim is not reconciled',()=>{
 for(const event of [
 {...raw,livemode:true},
 {...raw,type:'payment_intent.processing'},
 ])assert.equal(paidStripeEvidence(event),null);
 for(const invalid of [
 {amount_received:27501},{amount:0},{currency:'usd'},{status:'processing'},
 {livemode:true},{metadata:{saas_invoice_id:I}},{object:'charge'},
 ]){
  const e={...raw,data:{object:{...raw.data.object,...invalid}}};
  assert.throws(()=>paidStripeEvidence(e),/invalid_test_payment_evidence/);
 }
});
