import test from 'node:test';import assert from 'node:assert/strict';
import {assertSaasSwitchOwner as guard} from '../../src/domain/subscription-change-owner-scope.mjs';
const actorId='5237ae67-317f-450f-b174-1a3ea1890684',stationId='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const membership={user_id:actorId,station_id:stationId,scope_type:'station',role_code:'station_owner',active:true};
test('same owner with active scoped membership passes',()=>assert.equal(guard({actorId,stationId,memberships:[membership]}).authorized,true));
test('cashier, sales, corporate, inactive and foreign station denied',()=>{for(const patch of [{role_code:'cashier'},{role_code:'sales'},{scope_type:'corporate_company'},{active:false},{station_id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'}])assert.throws(()=>guard({actorId,stationId,memberships:[{...membership,...patch}]}),/permission denied/);});
test('cannot authorize membership of a different user or missing list',()=>{assert.throws(()=>guard({actorId,stationId,memberships:[{...membership,user_id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'}]}));assert.throws(()=>guard({actorId,stationId,memberships:null}));});
