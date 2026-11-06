import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeStationPlanChange,cancelStationPlanChange,inspectPlanChangeActivation}
 from '../../src/domain/subscription-change-intent.mjs';

const data={
 actorId:'5237ae67-317f-450f-b174-1a3ea1890684',
 stationId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',
 currentSubscriptionId:'cd9b6231-f6ca-4c65-8d46-172d7229ce47',
 currentPlanId:'6a22e123-95fa-44ee-b6e1-9290dc43e36b',
 nextPlanId:'a0000000-0000-4000-8000-000000000001',
 currentBillingFrequency:'monthly',nextBillingFrequency:'yearly',
 currentPeriodEndUtc:'2026-12-01T00:00:00Z',anchorDay:1,
 nowUtc:'2026-11-06T00:00:00Z',idempotencyKey:'pkg-change-safe-00001',
};
const fresh=()=>proposeStationPlanChange(data).intent;

test('01 intent is pending only, at exact old end and does not write billing or grant entitlements',()=>{
 const copy=structuredClone(data);
 const {intent,replayed}=proposeStationPlanChange(data);
 assert.equal(replayed,false);
 assert.equal(intent.status,'pending');
 assert.equal(intent.effectiveAtUtc,'2026-12-01T00:00:00.000Z');
 assert.equal(intent.oldPlanUntilExclusiveUtc,intent.effectiveAtUtc);
 assert.equal(intent.paymentState,'not_confirmed');
 assert.equal(intent.policy,'NEXT_RENEWAL_NO_SILENT_PRORATION');
 assert.deepEqual(data,copy);
});
test('02 identical idempotency key and exact payload replay returns the existing intent',()=>{
 const original=fresh();
 const output=proposeStationPlanChange({...data,existingIntent:original});
 assert.equal(output.replayed,true);
 assert.deepEqual(output.intent,original);
 assert.notStrictEqual(output.intent,original);
});
test('03 key reused with a different plan or start date is rejected before scheduling',()=>{
 const original=fresh();
 for(const patch of [
  {nextPlanId:'a0000000-0000-4000-8000-000000000002'},
  {requestedStartOn:'2027-01-01',mode:'future_renewal'},
 ]){
  assert.throws(()=>proposeStationPlanChange({...data,...patch,existingIntent:original}),
   /idempotency payload mismatch/);
 }
});
test('04 two different keys cannot create parallel open plans for the same station',()=>{
 assert.throws(()=>proposeStationPlanChange({...data,
  idempotencyKey:'pkg-change-safe-00002',existingIntent:fresh()}),/open transition/);
});
test('05 unrelated station cannot replay, inspect or cancel another station intent',()=>{
 const intent=fresh(),foreign='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
 assert.throws(()=>proposeStationPlanChange({...data,stationId:foreign,
  existingIntent:intent}),/foreign station/);
 assert.throws(()=>cancelStationPlanChange({intent,stationId:foreign,
  nowUtc:'2026-11-07T00:00:00Z'}),/foreign station/);
});
test('06 pending owner cancellation before effective instant is immutable and repeat-safe',()=>{
 const original=fresh();
 const cancelled=cancelStationPlanChange({intent:original,stationId:data.stationId,
  nowUtc:'2026-11-30T23:59:59Z'});
 assert.equal(cancelled.status,'cancelled');
 assert.equal(original.status,'pending');
 assert.deepEqual(cancelStationPlanChange({intent:cancelled,stationId:data.stationId,
  nowUtc:'2026-12-03T00:00:00Z'}),cancelled);
 assert.deepEqual(inspectPlanChangeActivation({intent:cancelled,
  nowUtc:'2026-12-01T00:00:00Z',paymentConfirmed:true}),
  {eligible:false,reason:'cancelled'});
});
test('07 after boundary cancellation fails and current plan remains authoritative',()=>{
 assert.throws(()=>cancelStationPlanChange({intent:fresh(),stationId:data.stationId,
  nowUtc:'2026-12-01T00:00:00Z'}),/cannot be cancelled/);
});
test('08 activation is blocked before effective instant even if payment flag set',()=>{
 assert.deepEqual(inspectPlanChangeActivation({intent:fresh(),
  nowUtc:'2026-11-30T23:59:59Z',paymentConfirmed:true}),
  {eligible:false,reason:'effective_time_not_reached'});
});
test('09 activation at boundary without trusted paid state remains blocked',()=>{
 assert.deepEqual(inspectPlanChangeActivation({intent:fresh(),
  nowUtc:'2026-12-01T00:00:00Z'}),
  {eligible:false,reason:'payment_not_confirmed'});
});
test('10 confirmed payment yields readiness but never claims actual activation',()=>{
 const output=inspectPlanChangeActivation({intent:fresh(),
  nowUtc:'2026-12-01T00:00:00Z',paymentConfirmed:true});
 assert.equal(output.eligible,true);
 assert.equal(output.reason,'requires_atomic_authorized_db_activation');
 assert.equal(output.stationId,data.stationId);
 assert.equal(output.nextPlanId,data.nextPlanId);
});
test('11 already applied transition cannot be activated twice',()=>{
 assert.deepEqual(inspectPlanChangeActivation({intent:{...fresh(),status:'applied'},
  nowUtc:'2026-12-02T00:00:00Z',paymentConfirmed:true}),
  {eligible:false,reason:'already_applied'});
});
test('12 mismatched, invalid identity or request key is fail-closed',()=>{
 assert.throws(()=>proposeStationPlanChange({...data,stationId:'wrong'}),/station ID/);
 assert.throws(()=>proposeStationPlanChange({...data,idempotencyKey:'short'}),/idempotency/);
 assert.throws(()=>proposeStationPlanChange({...data,currentSubscriptionId:'wrong'}),/subscription/);
});
