import test from 'node:test';
import assert from 'node:assert/strict';
import {succeededTestRefundEvidence} from '../../src/domain/stripe-refund-evidence.mjs';
const event={id:'evt_QARfValid123456',type:'refund.updated',livemode:false,
 data:{object:{id:'re_QARfValid123456',object:'refund',
  status:'succeeded',amount:12345,currency:'thb',
  payment_intent:'pi_QARfValid123456',charge:'ch_QARfValid123456'}}};
test('only confirmed Stripe TEST refunds produce evidence for existing PI binding',()=>{
 assert.deepEqual(succeededTestRefundEvidence(event),{
  eventId:'evt_QARfValid123456',refundId:'re_QARfValid123456',
  paymentIntentId:'pi_QARfValid123456',chargeId:'ch_QARfValid123456',
  amountSatang:12345,currency:'thb',status:'succeeded',livemode:false,
 });
 assert.equal(succeededTestRefundEvidence({...event,type:'refund.created'})?.amountSatang,12345);
 // Official Stripe Refund sample omits livemode; the signed Event carries it.
 assert.equal(succeededTestRefundEvidence({...event,data:{object:{...event.data.object,livemode:false}}})?.amountSatang,12345);
 for(const type of ['refund.failed','charge.refunded','charge.dispute.created',
   'payment_intent.succeeded']){
  assert.equal(succeededTestRefundEvidence({...event,type}),null);
 }
 assert.equal(succeededTestRefundEvidence({...event,livemode:true}),null);
 for(const status of ['pending','requires_action','failed','canceled',null]){
  assert.equal(succeededTestRefundEvidence({...event,
   data:{object:{...event.data.object,status}}}),null);
 }
});
test('malformed provider refund evidence never becomes accounting proof',()=>{
 const scenarios=[
  {id:'re_bad!'}, {charge:null},{payment_intent:null},
  {livemode:true},{currency:'usd'},{amount:0},{amount:-1},
  {amount:NaN},{amount:100000000},{amount:1.1},{object:'charge'},
 ];
 for(const changed of scenarios)
  assert.throws(()=>succeededTestRefundEvidence({...event,
   data:{object:{...event.data.object,...changed}}}),/invalid_test_refund_evidence/);
});
