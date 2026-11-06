import test from 'node:test';import assert from 'node:assert/strict';
import {inspectSaasPaymentPreflight as fn} from '../../src/domain/subscription-change-payment-preflight.mjs';
const a={paymentMethod:'card',providerEventId:'evt_12345678',verifiedServerSide:true,amountDueSatang:'10000',amountReceivedSatang:'10000'};
test('untrusted or missing verification always blocked',()=>assert.equal(fn({...a,verifiedServerSide:false}).ready,false));
test('missing provider event or underpayment blocked',()=>{assert.equal(fn({...a,providerEventId:''}).ready,false);assert.equal(fn({...a,amountReceivedSatang:'9999'}).ready,false);});
test('matching amounts only authorize further ledger reconciliation',()=>{const r=fn(a);assert.equal(r.ready,true);assert.match(r.reason,/requires_ledger/);});
test('bad method, floats, negatives and excess integer lengths rejected',()=>{for(const bad of ['-1','1.00','9999999999999'])assert.throws(()=>fn({...a,amountDueSatang:bad}));assert.throws(()=>fn({...a,paymentMethod:'cash'}));});
