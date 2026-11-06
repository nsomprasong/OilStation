import test from 'node:test';import assert from 'node:assert/strict';
import {inspectSaasWebhookReplay as fn} from '../../src/domain/subscription-change-webhook-dedupe.mjs';
const a={provider:'stripe_test',eventId:'evt_12345678',knownEventIds:[],signatureVerified:true};
test('unverified event never enters payment processing',()=>assert.equal(fn({...a,signatureVerified:false}).process,false));
test('duplicate provider key denied',()=>assert.equal(fn({...a,knownEventIds:['stripe_test:evt_12345678']}).reason,'duplicate_provider_event'));
test('new verified event still requires atomic database unique insertion',()=>{const r=fn(a);assert.equal(r.process,false);assert.equal(r.reason,'requires_atomic_unique_ledger_insert');});
test('invalid provider, key and evidence rejected',()=>{assert.throws(()=>fn({...a,provider:'fake'}));assert.throws(()=>fn({...a,eventId:'bad'}));assert.throws(()=>fn({...a,knownEventIds:null}));});
