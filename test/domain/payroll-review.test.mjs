import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPayrollReview} from '../../src/domain/payroll-review.mjs';

const statutory={reviewed:true,taxSatang:0n,socialSecuritySatang:0n};
const monthly={type:'monthly',rateSatang:3_000_000n};
const daily={type:'daily',rateSatang:45_000n};
const hourly={type:'hourly',rateSatang:12_000n};
const day=(date,status,id='a',fields={})=>
 ({date,status,shiftId:id,reviewed:true,...fields});
const review=(o={})=>buildPayrollReview({
 wage:monthly,days:[],overtime:[],advances:[],
 statutory,policy:{monthlyDivisorDays:30},...o
});
const net=x=>{assert.equal(x.status,'ready_for_review',x.issueCodes.join(','));assert.equal(x.payable,false);return x.summary.netSatang};
const blocked=(x,code)=>{assert.equal(x.status,'blocked');assert.equal(x.payable,false);assert.equal(x.summary,null);assert.ok(x.issueCodes.includes(code),x.issueCodes.join(','));};

test('monthly wage pays approved sick/annual leave, prorates explicitly reviewed unpaid leave and absence',()=>{
 const days=[
  day('2026-11-01','worked','d1',{workedMinutes:480}),
  day('2026-11-02','paid_leave','d2',{paidMinutes:480}),
  day('2026-11-03','unpaid_leave','d3'),
  day('2026-11-04','absent','d4'),
  day('2026-11-05','off','d5'),
 ];
 const r=review({days});
 assert.equal(net(r),2_800_000n);
 assert.equal(r.summary.baseSatang,2_800_000n);
});
test('daily wages pay once for double shifts on the same day and approved paid leave separately',()=>{
 const days=[day('2026-11-11','worked','morning',{workedMinutes:480,startMinute:360,endMinute:840}),
  day('2026-11-11','substitute','evening',{workedMinutes:480,startMinute:840,endMinute:1320}),
  day('2026-11-12','paid_leave','leave',{paidMinutes:480}),
  day('2026-11-13','absent','absent')];
 const r=review({wage:daily,days});
 assert.equal(net(r),90_000n);
 assert.equal(r.summary.workedMinutes,960);
});
test('hourly wages use only reviewed minutes and prevent floating point loss',()=>{
 const r=review({wage:hourly,days:[
  day('2026-11-11','worked','a',{workedMinutes:60}),
  day('2026-11-12','paid_leave','b',{paidMinutes:30}),
 ]});
 assert.equal(net(r),18_000n);
});
test('partial reviewed OT is added once; requested and rejected hours are never paid',()=>{
 const r=review({days:[day('2026-11-01','worked','a',{workedMinutes:480})],
  overtime:[
   {id:'1',status:'partial',requestedMinutes:60,approvedMinutes:45,approvedPaySatang:10_125n,reviewed:true},
   {id:'2',status:'pending',requestedMinutes:90},
   {id:'3',status:'rejected',requestedMinutes:120},
  ]});
 assert.equal(net(r),3_010_125n);
 assert.deepEqual(r.warnings,['pending_ot_excluded']);
});
test('unreviewed OT, excessive partial OT and duplicate OT IDs block review',()=>{
 blocked(review({overtime:[{id:'a',status:'approved',requestedMinutes:60,
  approvedMinutes:60,approvedPaySatang:10_000n,reviewed:false}]}),'ot_approval_invalid');
 blocked(review({overtime:[{id:'a',status:'partial',requestedMinutes:30,
  approvedMinutes:50,approvedPaySatang:10_000n,reviewed:true}]}),'ot_approval_invalid');
 blocked(review({overtime:[
  {id:'a',status:'rejected',requestedMinutes:30},
  {id:'a',status:'rejected',requestedMinutes:30},
 ]}),'duplicate_ot');
});
test('pending, incomplete or unreviewed punches never silently turn into absence or salary',()=>{
 blocked(review({days:[day('2026-11-01','pending','a',{reviewed:false})]}),'unreviewed_attendance_or_leave');
 blocked(review({days:[day('2026-11-01','absent','a',{reviewed:false})]}),'unreviewed_attendance_or_leave');
 blocked(review({days:[day('2026-11-01','paid_leave','a',{reviewed:false})]}),'unreviewed_attendance_or_leave');
});
test('overlapping dual shifts, duplicate shift ID or contradictory absence and work are blocked',()=>{
 blocked(review({wage:hourly,days:[
  day('2026-11-10','worked','a',{workedMinutes:480,startMinute:360,endMinute:840}),
  day('2026-11-10','substitute','b',{workedMinutes:60,startMinute:800,endMinute:860}),
 ]}),'overlapping_shifts');
 blocked(review({days:[
  day('2026-11-10','worked','a',{workedMinutes:400}),
  day('2026-11-11','worked','a',{workedMinutes:400}),
 ]}),'duplicate_shift');
 blocked(review({days:[
  day('2026-11-10','worked','a',{workedMinutes:400}),
  day('2026-11-10','absent','b'),
 ]}),'contradictory_daily_status');
});
test('salary advance requests or approvals do not trigger a deduction without disbursement',()=>{
 const base={id:'a',outstandingSatang:50_000n,plannedSatang:10_000n,
  allowableDeductionSatang:5_000n};
 const notDisbursed=review({advances:[{...base,status:'approved'}]});
 assert.equal(net(notDisbursed),3_000_000n);
 const pending=review({advances:[{...base,status:'requested'}]});
 assert.equal(net(pending),3_000_000n);
});
test('disbursed advance cannot be deducted without authorization, caps both remaining and deduction policy',()=>{
 const adv={id:'a',status:'paid',outstandingSatang:3_000n,plannedSatang:10_000n,
  allowableDeductionSatang:8_000n,deductionAuthorized:true};
 const r=review({advances:[adv]});
 assert.equal(net(r),2_997_000n);
 assert.equal(r.summary.advanceRepaymentSatang,3_000n);
 blocked(review({advances:[{...adv,deductionAuthorized:false}]}),'advance_deduction_unapproved');
});
test('source period adjustments, approved OT, tax and social security reconcile in integer satang',()=>{
 const r=review({adjustmentSatang:-10_000n,
  statutory:{reviewed:true,taxSatang:8_000n,socialSecuritySatang:4_000n,
   otherEarningsSatang:3_000n,otherDeductionsSatang:1_000n},
  overtime:[{id:'a',status:'approved',requestedMinutes:30,approvedMinutes:30,
   approvedPaySatang:9_000n,reviewed:true}]});
 assert.equal(net(r),2_989_000n);
 assert.equal(r.summary.grossSatang,3_002_000n);
 assert.equal(r.summary.deductionsSatang,13_000n);
});
test('statutory review is mandatory and deductions above gross never become negative payout',()=>{
 blocked(review({statutory:null}),'statutory_rules_unreviewed');
 blocked(review({statutory:{...statutory,reviewed:false}}),'statutory_rules_unreviewed');
 blocked(review({statutory:{...statutory,taxSatang:4_000_000n}}),
  'deductions_or_adjustments_exceed_pay');
});
test('invalid input is rejected without silently using zero values',()=>{
 assert.throws(()=>review({wage:{type:'monthly',rateSatang:NaN}}),/bigint/);
 assert.throws(()=>review({policy:{}}),/monthlyDivisorDays/);
 assert.throws(()=>review({days:[day('2026-02-30','worked')]}),/invalid day date/);
 assert.throws(()=>review({days:[day('2026-11-01','paid_leave','a',{paidMinutes:-1})]}),/paidMinutes/);
});
test('no reviewed leaves or OT can authorize a payout: results always payable=false',()=>{
 for(const wage of [monthly,daily,hourly]){
  const r=review({wage});
  assert.equal(r.payable,false);
  assert.notEqual(r.status,'paid');
 }
});
