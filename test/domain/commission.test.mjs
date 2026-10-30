import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCommission,adjustPaidCommission} from '../../src/domain/commission.mjs';

const params={paid:true,monthlyAmountSatang:50_000n,startDate:'2026-10-01',endDate:'2026-11-01',
  assignments:[{salesId:'A',from:'2026-10-01',until:'2026-10-16'},
    {salesId:'B',from:'2026-10-16',until:'2026-11-01'}]};
test('commission follows current Sales by effective days and sums exactly',()=>{
  const result=allocateCommission(params);
  assert.deepEqual(result.map(x=>x.days),[15,16]);
  assert.equal(result[0].amountSatang+result[1].amountSatang,50_000n);
  assert.equal(result[0].salesId,'A');
  assert.equal(result[1].salesId,'B');
});
test('invoice unpaid means no earned commission, including annual prepay rules',()=>{
  assert.deepEqual(allocateCommission({...params,paid:false}),[]);
});
test('gaps and overlap in Sales assignment are rejected instead of guessing recipient',()=>{
  assert.throws(()=>allocateCommission({...params,assignments:[{salesId:'A',from:'2026-10-01',until:'2026-10-10'}]}),/cover/);
  assert.throws(()=>allocateCommission({...params,assignments:[
    {salesId:'A',from:'2026-10-01',until:'2026-10-16'},
    {salesId:'B',from:'2026-10-15',until:'2026-11-01'}]}),/overlap/);
});
test('overpaid annual commission creates negative recovery not payroll deduction',()=>{
  assert.equal(adjustPaidCommission({previouslyPaidSatang:600_000n,revisedEntitlementSatang:300_000n}),-300_000n);
  assert.equal(adjustPaidCommission({previouslyPaidSatang:0n,revisedEntitlementSatang:300_000n}),300_000n);
});
