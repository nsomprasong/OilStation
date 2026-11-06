import test from 'node:test';import assert from 'node:assert/strict';
import {previewSaasGroupIsolation as fn} from '../../src/domain/subscription-change-group-isolation.mjs';
const a={targetStationId:'A',stationIds:['A','B','C'],existingInvoiceStationIds:['A','B','C']};
test('only target station eligible for any separate future switch process',()=>{const x=fn(a);assert.deepEqual(x.unaffectedStationIds,['B','C']);assert.equal(x.canMutateInvoices,false);});
test('existing grouped invoices are represented without modification',()=>{const original=structuredClone(a);const x=fn(a);assert.deepEqual(x.invoiceStationIdsUnchanged,['A','B','C']);assert.deepEqual(a,original);});
test('unknown station or duplicate group membership rejected',()=>{assert.throws(()=>fn({...a,targetStationId:'X'}));assert.throws(()=>fn({...a,stationIds:['A','A']}));});
test('too large or malformed members fail closed',()=>{assert.throws(()=>fn({...a,stationIds:Array(501).fill('A')}));assert.throws(()=>fn({...a,stationIds:[null,'B']}));});
