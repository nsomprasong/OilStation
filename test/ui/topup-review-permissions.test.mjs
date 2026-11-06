import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const m=(role,canApproveTopup=false)=>({scopeType:'station',stationId:'station-1',role,canApproveTopup});
test('finance screen for manager, finance_manager and explicit delegated pump worker',()=>{
 for(const member of [m('station_owner',true),m('manager',true),m('finance_manager',true),m('pump_staff',true),m('attendant',true)]){
  assert.ok(selectWorkspaceScreens([member]).some(s=>s.key==='finance'));
 }
});
test('cashier legacy workspace isolation stays unchanged; ungranted station staff get no finance menu',()=>{
 for(const member of [m('cashier',true),m('pump_staff',false),m('attendant',false)]){
  assert.ok(!selectWorkspaceScreens([member]).some(s=>s.key==='finance'));
 }
});
test('corporate company approval cannot be exposed by a forged station finance claim',()=>{
 const m={scopeType:'corporate_company',corporateCompanyId:'company-1',role:'corporate_admin',canApproveTopup:true};
 assert.ok(!selectWorkspaceScreens([m]).some(s=>s.key==='finance'));
});
