import test from 'node:test';
import assert from 'node:assert/strict';
import {testDisputeReviewEvidence} from '../../src/domain/stripe-dispute-evidence.mjs';
const DISPUTE={id:'evt_QADispute123456',type:'charge.dispute.created',
 livemode:false,created:1793500000,data:{object:{
  id:'du_QADispute123456',object:'dispute',livemode:false,
  charge:'ch_QADispute123456',payment_intent:'pi_QADispute123456',
  amount:10000,currency:'thb',status:'needs_response'}}};
const swap=(patch)=>({...DISPUTE,data:{object:{...DISPUTE.data.object,...patch}}});
test('realistic Stripe dispute object yields review-only TEST evidence',()=>{
 const e=testDisputeReviewEvidence(DISPUTE);
 assert.deepEqual(e,{eventId:DISPUTE.id,eventType:DISPUTE.type,
  eventCreated:DISPUTE.created,disputeId:'du_QADispute123456',
  paymentIntentId:'pi_QADispute123456',chargeId:'ch_QADispute123456',
  amountSatang:10000,currency:'thb',status:'needs_response',livemode:false});
 assert.equal(testDisputeReviewEvidence({...DISPUTE,type:'charge.refunded'}),null);
 assert.equal(testDisputeReviewEvidence({...DISPUTE,livemode:true}),null);
 assert.equal(testDisputeReviewEvidence({...DISPUTE,type:'charge.dispute.closed',
  data:{object:{...DISPUTE.data.object,status:'lost'}}})?.status,'lost');
});
test('nullable PI, live dispute, bad charge or nonterminal closed disputes fail closed',()=>{
 for(const bad of [{payment_intent:null},{payment_intent:'pi_bad!'},
  {charge:null},{object:'issuing.dispute'},{id:'idp_invalid'},
  {livemode:true},{currency:'usd'},{amount:0},{amount:1.5},
  {amount:100000000},{status:'completely_unknown'}]){
  assert.throws(()=>testDisputeReviewEvidence(swap(bad)),/invalid_test_dispute_evidence/);
 }
 assert.throws(()=>testDisputeReviewEvidence({...DISPUTE,created:null}),
  /invalid_test_dispute_evidence/);
 assert.throws(()=>testDisputeReviewEvidence({...DISPUTE,type:'charge.dispute.closed'}),
  /invalid_test_dispute_evidence/);
});
