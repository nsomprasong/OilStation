import test from 'node:test';import assert from 'node:assert/strict';
import {buildSaasSwitchPriceSnapshot as quote} from '../../src/domain/subscription-change-price-snapshot.mjs';
const input={subtotalSatang:'10000',discountSatang:'200',vatSatang:'686',totalSatang:'10486',paymentMethod:'promptpay',quoteVersion:'quote-2026-01'};
test('exact integer quote snapshot cannot mutate',()=>{const x=quote(input);assert.equal(x.totalSatang,'10486');assert.ok(Object.isFrozen(x));assert.equal(x.status,'QUOTE_ONLY_NOT_INVOICE');});
test('mismatched discounts, VAT and total reject',()=>{for(const patch of [{totalSatang:'10485'},{discountSatang:'11000'},{vatSatang:'687'}])assert.throws(()=>quote({...input,...patch}),/mismatch/);});
test('fractional, negative, huge or unsafe money cannot be accepted',()=>{for(const v of ['-1','1.2',123,'9999999999999','01'])assert.throws(()=>quote({...input,subtotalSatang:v}),/invalid/);});
test('payment method and quote version must be explicit',()=>{assert.throws(()=>quote({...input,paymentMethod:'cash'}));assert.throws(()=>quote({...input,quoteVersion:''}));});
