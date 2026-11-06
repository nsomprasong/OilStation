import test from 'node:test';import assert from 'node:assert/strict';
import {selectDueSaasChanges as fn} from '../../src/domain/subscription-change-due-selector.mjs';
const a={id:'one',stationId:'s1',status:'pending',effectiveAtUtc:'2026-12-01T00:00:00Z'};
test('future request excluded, exact UTC boundary included',()=>{assert.equal(fn({intents:[a],nowUtc:'2026-11-30T23:59:59Z'}).length,0);assert.equal(fn({intents:[a],nowUtc:'2026-12-01T00:00:00Z'}).length,1);});
test('cancelled and applied rows cannot be rescheduled',()=>{assert.equal(fn({intents:[{...a,status:'cancelled'},{...a,status:'applied'}],nowUtc:'2026-12-02T00:00:00Z'}).length,0);});
test('duplicate pending station detected rather than silently activating two',()=>assert.throws(()=>fn({intents:[a,{...a,id:'two'}],nowUtc:'2026-12-02T00:00:00Z'}),/duplicate/));
test('bounds and return values are immutable',()=>{const out=fn({intents:[a],nowUtc:'2026-12-02T00:00:00Z'});assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(out[0]));assert.throws(()=>fn({intents:[],nowUtc:'2026-12-02T00:00:00Z',limit:101}));});
