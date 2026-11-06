import test from 'node:test';import assert from 'node:assert/strict';
import {assessSaasInvoiceImmutability as fn} from '../../src/domain/subscription-change-invoice-lock.mjs';
const base={id:'i1',stationId:'s1',billingPeriodStart:'2026-11-01',billingPeriodEnd:'2026-12-01',totalSatang:'10000',currency:'THB',status:'draft'};
test('unchanged draft may be reviewed but no financial mutation occurs',()=>{const r=fn({original:base,proposed:{...base}});assert.equal(r.allowed,true);assert.equal(r.financialMutation,false);});
test('issued and paid invoices cannot be revised by package switch',()=>{for(const status of ['paid','issued']){const x={...base,status};assert.equal(fn({original:x,proposed:{...x,totalSatang:'9999'}}).allowed,false);}});
test('station, period, amount and status changes require separate controlled adjustment',()=>{for(const patch of [{stationId:'s2'},{totalSatang:'9999'},{billingPeriodEnd:'2027-01-01'},{status:'issued'}])assert.equal(fn({original:base,proposed:{...base,...patch}}).allowed,false);});
test('invalid snapshots and money rejected',()=>{assert.throws(()=>fn({original:null,proposed:base}));assert.throws(()=>fn({original:base,proposed:{...base,totalSatang:'-1'}}));});
