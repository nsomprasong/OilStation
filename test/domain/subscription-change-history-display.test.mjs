import test from 'node:test';import assert from 'node:assert/strict';
import {shapeSaasOwnerChangeHistory as shape} from '../../src/domain/subscription-change-history-display.mjs';
const row={nextPlanId:'plan-1',status:'pending',paymentStatus:'unconfirmed',effectiveAt:'2026-12-01T00:00:00Z'};
test('owner history view remains bounded at 20 even if server returns more',()=>{const r=shape({rows:Array(35).fill(row),plans:[]});assert.equal(r.length,20);assert.ok(Object.isFrozen(r));});
test('known plan displays name and exact instant',()=>{const r=shape({rows:[row],plans:[{id:'plan-1',name:'Standard'}]})[0];assert.equal(r.name,'Standard');assert.equal(r.effectiveAt,'2026-12-01T00:00:00.000Z');assert.equal(r.viewOnly,true);});
test('unknown status/time and archived plan are nonexecuting display placeholders',()=>{const r=shape({rows:[{...row,status:'sudo',effectiveAt:'bad'}],plans:[]})[0];assert.equal(r.name,'แพ็กเกจใหม่');assert.equal(r.status,'unknown');assert.equal(r.effectiveAt,null);});
test('malformed response or excessive limit fails closed',()=>{assert.throws(()=>shape({rows:'bad',plans:[]}));assert.throws(()=>shape({rows:[],plans:[],maxItems:1000}));});
