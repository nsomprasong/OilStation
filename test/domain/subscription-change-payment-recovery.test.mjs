import test from 'node:test';import assert from 'node:assert/strict';
import {previewSaasPaymentRecovery as fn} from '../../src/domain/subscription-change-payment-recovery.mjs';
const a={status:'failed',attempts:1,lastAttemptUtc:'2026-11-06T00:00:00Z',nowUtc:'2026-11-06T00:14:59Z'};
test('failed payment is not immediately reattempted',()=>assert.deepEqual(fn(a),{retry:false,reason:'cooldown',retryAtUtc:'2026-11-06T00:15:00.000Z'}));
test('first failure eligible for manual reconciliation only after 15 minutes',()=>{const r=fn({...a,nowUtc:'2026-11-06T00:15:00Z'});assert.equal(r.retry,true);assert.match(r.reason,/manual_reconciliation/);});
test('second failure waits 60 minutes and third fails closed',()=>{assert.equal(fn({...a,attempts:2,nowUtc:'2026-11-06T00:59:59Z'}).retry,false);assert.equal(fn({...a,attempts:3}).retry,false);});
test('paid, cancelled or pending never retry',()=>{for(const status of ['paid','cancelled','pending'])assert.equal(fn({...a,status}).retry,false);});
test('malformed counts or clock are rejected',()=>{assert.throws(()=>fn({...a,attempts:-1}));assert.throws(()=>fn({...a,nowUtc:'tomorrow'}));});
