import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAdvanceDeductions} from '../../src/domain/advance-payroll-readiness.mjs';
import {planAdvanceInstallments} from '../../src/domain/advance-installments.mjs';

const fixture={id:'qa-a',status:'approved',amountSatang:10001,
 outstandingSatang:10001,installments:3,firstDeductionDate:'2026-12-15',
 frequency:'monthly'};
const period={startDate:'2026-12-01',endDate:'2027-01-01'};
test('approved advance is NOT deductible before bank-confirmed disbursement',()=>{
 const review=reviewAdvanceDeductions(fixture,period);
 assert.equal(review.plannedInPeriodSatang,3333);
 assert.equal(review.deductibleSatang,0);
 assert.equal(review.postedSatang,0);
 assert.equal(review.payable,false);
 assert.deepEqual(review.blockers,['advance_not_disbursed']);
 assert.equal(review.schedule[0].reviewState,'awaiting_disbursement_verification');
});
test('paid flag alone is NOT proof of reconciled transfer or payroll approval',()=>{
 const review=reviewAdvanceDeductions({...fixture,status:'paid'},period);
 assert.equal(review.plannedInPeriodSatang,3333);
 assert.equal(review.deductibleSatang,0);
 assert.equal(review.payable,false);
 assert.deepEqual(review.blockers,['bank_evidence_and_payroll_approval_required']);
 assert.ok(review.schedule.every(x=>x.deductionAllowed===false));
});
test('partially repaid advances do not demand a previous installment again',()=>{
 const p=reviewAdvanceDeductions({...fixture,status:'paid',outstandingSatang:6668},{
  startDate:'2026-12-01',endDate:'2027-03-01'});
 assert.deepEqual(p.schedule.map(x=>x.settledSatang),[3333,0,0]);
 assert.deepEqual(p.schedule.map(x=>x.remainingSatang),[0,3333,3335]);
 assert.equal(p.plannedInPeriodSatang,6668);
 assert.equal(p.deductibleSatang,0);
});
test('partially repaid current installment only proposes the remaining satang',()=>{
 const p=reviewAdvanceDeductions({...fixture,status:'paid',outstandingSatang:8000},period);
 assert.equal(p.schedule[0].settledSatang,2001);
 assert.equal(p.schedule[0].remainingSatang,1332);
 assert.equal(p.plannedInPeriodSatang,1332);
});
test('requested, rejected and fully repaid states never generate deduction',()=>{
 for(const status of ['requested','rejected']){
  const r=reviewAdvanceDeductions({...fixture,status},period);
  assert.equal(r.deductibleSatang,0);
  assert.equal(r.payable,false);
  assert.ok(r.blockers.length);
 }
 const repaid=reviewAdvanceDeductions({...fixture,status:'repaid',outstandingSatang:0},
  {startDate:'2026-12-01',endDate:'2027-12-01'});
 assert.equal(repaid.plannedInPeriodSatang,0);
 assert.ok(repaid.schedule.every(x=>x.reviewState==='already_repaid'));
 assert.equal(repaid.payable,false);
});
test('period end is exclusive, and different months cannot double-count the same due date',()=>{
 const dec=reviewAdvanceDeductions(fixture,period);
 const jan=reviewAdvanceDeductions(fixture,{startDate:'2027-01-01',endDate:'2027-02-01'});
 const feb=reviewAdvanceDeductions(fixture,{startDate:'2027-02-01',endDate:'2027-03-01'});
 assert.deepEqual([dec.plannedInPeriodSatang,jan.plannedInPeriodSatang,
  feb.plannedInPeriodSatang],[3333,3333,3335]);
 assert.equal(dec.plannedInPeriodSatang+jan.plannedInPeriodSatang+feb.plannedInPeriodSatang,10001);
});
test('weekly and twice-monthly plans map across year boundary exactly',()=>{
 const weekly=reviewAdvanceDeductions({...fixture,frequency:'weekly',
  firstDeductionDate:'2026-12-30'},{
  startDate:'2026-12-01',endDate:'2027-01-01'});
 assert.equal(weekly.plannedInPeriodSatang,3333);
 const twice=reviewAdvanceDeductions({...fixture,frequency:'semi_monthly',
  firstDeductionDate:'2026-11-30'},period);
 assert.equal(twice.plannedInPeriodSatang,6668);
});
test('invalid calendar, stale balances and zero-satang installments fail closed',()=>{
 assert.throws(()=>reviewAdvanceDeductions(fixture,{startDate:'2026-02-30',endDate:'2026-03-01'}));
 assert.throws(()=>reviewAdvanceDeductions({...fixture,outstandingSatang:10002},period));
 assert.throws(()=>reviewAdvanceDeductions({...fixture,status:'paid',outstandingSatang:-1},period));
 assert.throws(()=>reviewAdvanceDeductions({...fixture,status:'weird'},period));
 assert.throws(()=>reviewAdvanceDeductions(fixture,{startDate:'2027-01-01',endDate:'2026-12-01'}));
 assert.throws(()=>planAdvanceInstallments({principalSatang:2,installments:3,
  firstDeductionDate:'2026-12-15',frequency:'monthly'}),/under one satang/);
});
