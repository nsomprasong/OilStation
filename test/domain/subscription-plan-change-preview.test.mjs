import test from 'node:test';
import assert from 'node:assert/strict';
import {previewSubscriptionPlanChange} from '../../src/domain/subscription-plan-change-preview.mjs';

const OLD='5237ae67-317f-450f-b174-1a3ea1890684';
const NEW='a0000000-0000-4000-8000-000000000001';
const base={
 currentPlanId:OLD,nextPlanId:NEW,
 currentBillingFrequency:'monthly',nextBillingFrequency:'yearly',
 currentPeriodEndUtc:'2026-12-01T00:00:00Z',
 anchorDay:1,nowUtc:'2026-11-06T02:00:00Z',
};

test('package change preview: monthly to yearly starts at EXACT old end (7AM Bangkok, no overlap)',()=>{
 const original=structuredClone(base);
 const result=previewSubscriptionPlanChange(base);
 assert.deepEqual(result,{
  currentPlanId:OLD,nextPlanId:NEW,mode:'next_renewal',
  oldPlanUntilExclusiveUtc:'2026-12-01T00:00:00.000Z',
  newPlanEffectiveAtUtc:'2026-12-01T00:00:00.000Z',
  startDateBangkok:'2026-12-01',startTimeBangkok:'07:00',
  oldPlanRenewalsBeforeSwitch:0,nextBillingFrequency:'yearly',
  prorationIncluded:false,status:'PREVIEW_ONLY_NO_BILLING_OR_ENTITLEMENT_MUTATION',
 });
 assert.deepEqual(base,original,'policy is pure and must not mutate passed station state');
});

test('package change preview: yearly to monthly preserves old plan until annual boundary',()=>{
 const result=previewSubscriptionPlanChange({...base,currentBillingFrequency:'yearly',
  nextBillingFrequency:'monthly',currentPeriodEndUtc:'2027-11-01T00:00:00Z'});
 assert.equal(result.newPlanEffectiveAtUtc,'2027-11-01T00:00:00.000Z');
 assert.equal(result.oldPlanUntilExclusiveUtc,result.newPlanEffectiveAtUtc);
 assert.equal(result.nextBillingFrequency,'monthly');
});

test('package change preview: future start must match an old-plan renewal, never leave unpriced gap',()=>{
 const result=previewSubscriptionPlanChange({...base,
  mode:'future_renewal',requestedStartOn:'2027-02-01'});
 assert.equal(result.newPlanEffectiveAtUtc,'2027-02-01T00:00:00.000Z');
 assert.equal(result.oldPlanRenewalsBeforeSwitch,2);
 assert.equal(result.startDateBangkok,'2027-02-01');
 assert.equal(result.startTimeBangkok,'07:00');
});

test('package change preview: rejects 15th, past calendar day, or wrong mode before any write',()=>{
 for(const date of ['2026-12-15','2026-11-30','2026-02-30','2026-13-01']){
  assert.throws(()=>previewSubscriptionPlanChange({...base,
   mode:'future_renewal',requestedStartOn:date}),/(renewal|start|date)/);
 }
 assert.throws(()=>previewSubscriptionPlanChange({...base,
  mode:'next_renewal',requestedStartOn:'2027-01-01'}),/next renewal/);
 assert.throws(()=>previewSubscriptionPlanChange({...base,
  mode:'immediate'}),/proration/);
});

test('package change preview: same plan, invalid frequency and elapsed subscription reject',()=>{
 assert.throws(()=>previewSubscriptionPlanChange({...base,nextPlanId:OLD}),/same plan/);
 assert.throws(()=>previewSubscriptionPlanChange({...base,nextBillingFrequency:'annual'}),/frequency/);
 assert.throws(()=>previewSubscriptionPlanChange({...base,anchorDay:0}),/anchor/);
 assert.throws(()=>previewSubscriptionPlanChange({...base,nowUtc:'2026-12-01T00:00:00Z'}),/passed/);
});

test('package change preview: preserves renewal anchor through February leap and March',()=>{
 const result=previewSubscriptionPlanChange({...base,
  currentPeriodEndUtc:'2028-01-31T00:00:00Z',anchorDay:31,
  nowUtc:'2027-12-10T00:00:00Z',mode:'future_renewal',requestedStartOn:'2028-03-31'});
 assert.equal(result.newPlanEffectiveAtUtc,'2028-03-31T00:00:00.000Z');
 assert.equal(result.oldPlanRenewalsBeforeSwitch,2,'Feb29 is the intermediate boundary');
});

test('package change preview: Bangkok midnight is not automatically UTC midnight',()=>{
 const result=previewSubscriptionPlanChange({...base,
  currentPeriodEndUtc:'2026-11-30T17:00:00Z',
  mode:'future_renewal',requestedStartOn:'2026-12-01'});
 assert.equal(result.startDateBangkok,'2026-12-01');
 assert.equal(result.startTimeBangkok,'00:00');
 assert.equal(result.newPlanEffectiveAtUtc,'2026-11-30T17:00:00.000Z');
});

for(const item of [
 'PC-01 active monthly→yearly station subscription switch persisted',
 'PC-02 annual→monthly switch with module entitlement continuity',
 'PC-03 scheduled future start with server-confirmed effective timestamp',
 'PC-04 immediate mid-cycle proration/credit with explicit consent',
 'PC-05 authorized API rejects all unsupported date and overlap inputs',
 'PC-06 inactive, archived and incompatible plan selection denied',
 'PC-07 concurrent request ID replay creates only one change + invoice',
 'PC-08 owner can cancel/reschedule pending switch, audited',
 'PC-09 renewal price snapshot/VAT/QR discount preserves issued invoices',
 'PC-10 unrelated station/cashier/Sales cannot schedule or cancel',
 'PC-11 atomic activation at effective instant and end-exclusive old plan',
 'PC-12 group billing keeps other stations and commissions unchanged',
]){
 test.todo('INTEGRATION BLOCKED — '+item);
}

test('package change preview never defaults to an old hard-coded clock',()=>{
 const {nowUtc, ...withoutClock}=base;
 assert.throws(()=>previewSubscriptionPlanChange(withoutClock),/invalid period-end instant/);
});

test('package preview rejects normalized impossible ISO calendar dates, clock fields and offsets',()=>{
 for(const bad of [
  '2026-02-30T00:00:00Z','2026-02-29T00:00:00Z',
  '2026-13-01T00:00:00Z','2026-11-31T00:00:00Z',
  '2026-12-01T24:00:00Z','2026-12-01T12:60:00Z',
  '2026-12-01T12:30:60Z','2026-12-01T12:00:00+15:00',
  '2026-12-01T12:00:00+14:30','2026-12-01T12:00:00-02:60',
 ]){
  assert.throws(()=>previewSubscriptionPlanChange({...base,currentPeriodEndUtc:bad}),/invalid period-end instant/,bad);
  assert.throws(()=>previewSubscriptionPlanChange({...base,nowUtc:bad}),/invalid period-end instant/,bad);
 }
 const valid=previewSubscriptionPlanChange({...base,
  currentPeriodEndUtc:'2026-12-01T07:00:00+07:00'});
 assert.equal(valid.newPlanEffectiveAtUtc,'2026-12-01T00:00:00.000Z');
});
