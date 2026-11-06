import test from 'node:test';import assert from 'node:assert/strict';
import {previewSaasSwitchReschedule as fn} from '../../src/domain/subscription-change-reschedule-plan.mjs';
const a={existingIntent:{status:'pending',effectiveAtUtc:'2026-12-01T00:00:00Z',idempotencyKey:'old-request-001'},nowUtc:'2026-11-06T00:00:00Z',newIdempotencyKey:'new-request-002'};
test('rescheduling means atomic cancel and new audited request, not in-place date rewrite',()=>{const r=fn(a);assert.equal(r.allowed,true);assert.equal(r.mustPreserveOldAudit,true);assert.match(r.reason,/atomic_cancel/);});
test('same request key is never reused for changed date',()=>assert.throws(()=>fn({...a,newIdempotencyKey:'old-request-001'})));
test('applied, cancelled, and reached boundary cannot be rescheduled',()=>{for(const status of ['applied','cancelled','failed'])assert.equal(fn({...a,existingIntent:{...a.existingIntent,status}}).allowed,false);assert.equal(fn({...a,nowUtc:'2026-12-01T00:00:00Z'}).allowed,false);});
test('malformed request and clock rejected',()=>{assert.throws(()=>fn({...a,existingIntent:null}));assert.throws(()=>fn({...a,nowUtc:'bad'}));});
