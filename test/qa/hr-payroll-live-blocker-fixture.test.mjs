import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPayrollReadiness} from '../../src/domain/hr-payroll-readiness.mjs';
import {buildPayrollReview} from '../../src/domain/payroll-review.mjs';

// These numeric counters are a sanitized fixed regression fixture, measured
// by READ-ONLY production SQL on 2026-11-04 for fictional QA employees.
// Test execution never queries or modifies the shared Supabase database.
const BASE={
 employeeId:'11111111-1111-4111-8111-111111111111',
 stationId:'22222222-2222-4222-8222-222222222222',
 startDate:'2026-11-01',endDate:'2026-12-01',
 employeeStatus:'active',wageType:'daily',wageSatang:'45000',
 payrollFrequency:'monthly',
 pendingLeave:0,approvedLeave:0,approvedUnpaidLeave:0,
 pendingOt:0,approvedOt:0,scheduledShifts:0,attendancePunches:0,
 unreviewedPunches:0,rejectedPunches:0,approvedPrimaryPayees:0,
 openAdvances:0,policyReviewed:false,statutoryReviewed:false,
 readOnly:true,payable:false,postedSatang:0,
};
const scoped=extra=>assessPayrollReadiness({...BASE,...extra});
function blocked(x,codes){
 assert.equal(x.status,'blocked_pending_review');
 assert.equal(x.payable,false);
 assert.equal(x.readOnly,true);
 assert.equal(x.salaryCanBeApproved,false);
 assert.equal(x.bankTransferAuthorized,false);
 assert.equal(x.deductibleSatang,0);
 assert.equal(x.postedSatang,0);
 assert.equal(Object.hasOwn(x,'wageSatang'),false);
 for(const code of codes)assert.ok(x.issueCodes.includes(code),
  'expected '+code+', got '+x.issueCodes.join(','));
}

test('live-derived QA-S01-A November blockers: approved OT, unchecked punches and advance remain nonpayable',()=>{
 const x=scoped({approvedOt:13,scheduledShifts:12,attendancePunches:6,
  unreviewedPunches:2,approvedPrimaryPayees:1,openAdvances:8});
 blocked(x,['overtime_rate_unverified','unreviewed_attendance',
  'advance_reconciliation_required','wage_and_leave_policy_unreviewed',
  'tax_social_security_unreviewed']);
 assert.equal(x.evidenceCounts.approvedOt,13);
 assert.equal(x.evidenceCounts.unreviewedPunches,2);
});
test('live-derived other two QA stations cannot pay without punch, verified payee and wage policy',()=>{
 for(const code of ['QA-S01-B','QA-S02-A']){
  const x=scoped({scheduledShifts:1,attendancePunches:0,
   approvedPrimaryPayees:0,openAdvances:0});
  blocked(x,['missing_attendance','approved_primary_payee_required',
   'wage_and_leave_policy_unreviewed','tax_social_security_unreviewed']);
  assert.equal(x.evidenceCounts.scheduledShifts,1,code);
 }
});
test('live-derived approved December annual leave does not decide leave pay or auto-deduct',()=>{
 const x=scoped({startDate:'2026-12-01',endDate:'2027-01-01',
  approvedLeave:1,approvedPrimaryPayees:1,openAdvances:8});
 blocked(x,['leave_pay_policy_unverified','advance_reconciliation_required',
  'wage_and_leave_policy_unreviewed','tax_social_security_unreviewed']);
 assert.equal(x.evidenceCounts.approvedLeave,1);
});
test('review-only OT to single-shift wage scenario excludes pending OT and unpaid advance',()=>{
 const result=buildPayrollReview({
  wage:{type:'daily',rateSatang:45_000n},
  days:[{date:'2026-11-15',status:'worked',shiftId:'qa-shift-1',
   reviewed:true,workedMinutes:480,startMinute:480,endMinute:960}],
  overtime:[
   {id:'qa-partial',status:'partial',requestedMinutes:60,approvedMinutes:45,
    approvedPaySatang:10_125n,reviewed:true},
   {id:'qa-pending',status:'pending',requestedMinutes:60},
   {id:'qa-rejected',status:'rejected',requestedMinutes:30},
  ],
  advances:[{id:'qa-advance',status:'approved',outstandingSatang:30_000n,
   plannedSatang:10_000n,allowableDeductionSatang:10_000n}],
  statutory:{reviewed:true,taxSatang:0n,socialSecuritySatang:0n},
  policy:{monthlyDivisorDays:30},
 });
 assert.equal(result.status,'ready_for_review');
 assert.equal(result.payable,false);
 assert.equal(result.summary.baseSatang,45_000n);
 assert.equal(result.summary.approvedOtSatang,10_125n);
 assert.equal(result.summary.advanceRepaymentSatang,0n);
 assert.equal(result.summary.netSatang,55_125n);
 assert.deepEqual(result.warnings,['pending_ot_excluded']);
 assert.equal(Object.hasOwn(result,'transfer'),false);
});
test('same reviewed wage inputs fail closed if punch review is missing',()=>{
 const result=buildPayrollReview({
  wage:{type:'daily',rateSatang:45_000n},
  days:[{date:'2026-11-15',status:'worked',shiftId:'qa-shift-1',
   reviewed:false,workedMinutes:480,startMinute:480,endMinute:960}],
  statutory:{reviewed:true,taxSatang:0n,socialSecuritySatang:0n},
 });
 assert.equal(result.status,'blocked');
 assert.equal(result.payable,false);
 assert.equal(result.summary,null);
 assert.ok(result.issueCodes.includes('unreviewed_attendance'));
});
test('payment flags and misleading evidence cannot turn a read-only readiness result into permission to pay',()=>{
 for(const altered of [{payable:true},{readOnly:false},{postedSatang:1},
  {attendancePunches:1,unreviewedPunches:2}]){
  assert.throws(()=>scoped(altered));
 }
});
