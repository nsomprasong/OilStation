import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPayrollReadiness} from '../../src/domain/hr-payroll-readiness.mjs';
const ID='11111111-1111-4111-8111-111111111111';
function evidence(extra={}){return {
 employeeId:ID,stationId:ID,startDate:'2026-11-01',endDate:'2026-12-01',
 employeeStatus:'active',wageType:'monthly',wageSatang:'2000000',
 payrollFrequency:'monthly',pendingLeave:0,approvedLeave:0,approvedUnpaidLeave:0,
 pendingOt:0,approvedOt:0,scheduledShifts:3,attendancePunches:6,
 unreviewedPunches:0,rejectedPunches:0,approvedPrimaryPayees:1,openAdvances:0,
 policyReviewed:false,statutoryReviewed:false,readOnly:true,payable:false,postedSatang:0,
 ...extra};}
test('complete evidence still blocked on independently reviewed wage and statutory policy',()=>{
 const x=assessPayrollReadiness(evidence());
 assert.equal(x.readOnly,true);assert.equal(x.payable,false);
 assert.equal(x.salaryCanBeApproved,false);assert.equal(x.postedSatang,0);
 assert.deepEqual(x.issueCodes,['wage_and_leave_policy_unreviewed','tax_social_security_unreviewed']);
 assert.equal(Object.hasOwn(x,'wageSatang'),false);
});
test('pending leave and OT, missing punch, unapproved payee, open advance all block',()=>{
 const x=assessPayrollReadiness(evidence({pendingLeave:1,pendingOt:1,
  scheduledShifts:1,attendancePunches:0,approvedPrimaryPayees:0,openAdvances:1}));
 for(const code of ['pending_leave','pending_overtime','missing_attendance',
  'approved_primary_payee_required','advance_reconciliation_required'])
  assert.ok(x.issueCodes.includes(code),code);
 assert.equal(x.deductibleSatang,0);
});
test('approved leave and OT require explicit policy, not automatic deduction',()=>{
 const x=assessPayrollReadiness(evidence({approvedLeave:1,approvedUnpaidLeave:1,
  approvedOt:1,attendancePunches:2,unreviewedPunches:1}));
 for(const code of ['leave_pay_policy_unverified','overtime_rate_unverified','unreviewed_attendance'])
  assert.ok(x.issueCodes.includes(code),code);
});
test('invalid amount, counters and safety flags fail closed',()=>{
 for(const sample of [
  evidence({wageSatang:'1.99'}),evidence({wageSatang:'-2'}),
  evidence({attendancePunches:1,unreviewedPunches:2}),
  evidence({approvedLeave:0,approvedUnpaidLeave:1}),
  evidence({payable:true}),evidence({readOnly:false}),evidence({postedSatang:10}),
  evidence({openAdvances:-1}),evidence({pendingOt:NaN}),
 ]) assert.throws(()=>assessPayrollReadiness(sample));
});
test('no default wage, inactive employee or unknown pay schedule are never ready',()=>{
 const x=assessPayrollReadiness(evidence({employeeStatus:'terminated',wageType:null,
  wageSatang:'0',payrollFrequency:null}));
 assert.ok(x.issueCodes.includes('employee_not_active'));
 assert.ok(x.issueCodes.includes('wage_not_configured'));
 assert.ok(x.issueCodes.includes('frequency_not_configured'));
});
