import test from 'node:test';import assert from 'node:assert/strict';
import {buildSaasTransitionAudit as fn} from '../../src/domain/subscription-change-audit-record.mjs';
const id='5237ae67-317f-450f-b174-1a3ea1890684',different='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const a={actorId:id,stationId:id,requestId:id,previousPlanId:id,nextPlanId:different,occurredAtUtc:'2026-11-06T03:00:00Z',kind:'scheduled'};
test('audit proposal records actor and exact transition without payment write',()=>{const r=fn(a);assert.equal(r.kind,'scheduled');assert.equal(r.financialMutation,false);assert.ok(Object.isFrozen(r));});
test('cancellation and applied audit types accepted',()=>{for(const kind of ['cancelled','applied','payment_confirmed','activation_blocked'])assert.equal(fn({...a,kind}).kind,kind);});
test('unexpected events, malformed actors and same plan are rejected',()=>{assert.throws(()=>fn({...a,kind:'delete_account'}));assert.throws(()=>fn({...a,actorId:'bad'}));assert.throws(()=>fn({...a,nextPlanId:id}));});
