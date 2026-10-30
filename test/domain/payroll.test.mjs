import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateNetPayroll,approvedAdvanceRepayment} from '../../src/domain/payroll.mjs';

test('approved OT is included, but proposed/unapproved OT is not',()=>{
  const pay=calculateNetPayroll({baseSatang:150_000n,approvedOtSatang:20_000n,
    proposedOtSatang:80_000n,taxSatang:4_000n,socialSecuritySatang:2_500n});
  assert.deepEqual(pay,{grossSatang:170_000n,deductionsSatang:6_500n,netSatang:163_500n});
});
test('negative adjustment from a previously closed payroll is accounted for in current period',()=>{
  const pay=calculateNetPayroll({baseSatang:100_000n,adjustmentSatang:-2_000n});
  assert.equal(pay.netSatang,98_000n);
});
test('no deductions beyond net and no negative statutory deductions',()=>{
  assert.throws(()=>calculateNetPayroll({baseSatang:10n,taxSatang:11n}),/negative/);
  assert.throws(()=>calculateNetPayroll({baseSatang:10n,taxSatang:-1n}),/negative/);
});
test('advance repayment respects outstanding balance and authorized deduction cap',()=>{
  assert.equal(approvedAdvanceRepayment({outstandingSatang:30_000n,plannedSatang:5_000n,allowableDeductionSatang:2_000n}),2_000n);
  assert.equal(approvedAdvanceRepayment({outstandingSatang:1_000n,plannedSatang:5_000n,allowableDeductionSatang:5_000n}),1_000n);
});
