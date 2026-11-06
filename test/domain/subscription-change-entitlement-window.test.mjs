import test from 'node:test';import assert from 'node:assert/strict';
import {previewSaasEntitlementCutover as fn} from '../../src/domain/subscription-change-entitlement-window.mjs';
const base={effectiveAtUtc:'2026-12-01T00:00:00Z',currentModules:['qr'],nextModules:['hr','qr']};
test('before exact instant old QR only',()=>{const p=fn({...base,nowUtc:'2026-11-30T23:59:59Z'});assert.deepEqual(p.activeModules,['qr']);assert.equal(p.activationSource,'existing_plan');});
test('at and after exact instant new entitlement preview',()=>{for(const time of ['2026-12-01T00:00:00Z','2026-12-01T00:00:01Z'])assert.deepEqual(fn({...base,nowUtc:time}).activeModules,['hr','qr']);});
test('preview immutable and read-only',()=>{const p=fn({...base,nowUtc:'2026-12-01T00:00:00Z'});assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.activeModules));});
test('invalid, duplicate or unexpected module denied',()=>{for(const next of [['unknown'],['qr','qr'],['qr','hr','extra']])assert.throws(()=>fn({...base,nextModules:next,nowUtc:'2026-12-01T00:00:00Z'}));});
