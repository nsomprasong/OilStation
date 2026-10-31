import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const screens=(scopeType,role)=>selectWorkspaceScreens([{scopeType,role,
 stationId:'22222222-2222-4222-8222-222222222222',
 organizationId:'33333333-3333-4333-8333-333333333333'}]).map(x=>x.key);
test('delegated finance manager sees Finance but not Fuel/HR/Customer creation',()=>{
 const allowed=screens('station','finance_manager');
 assert.ok(allowed.includes('finance'));
 assert.ok(!allowed.includes('hr'));
 assert.ok(!allowed.includes('customers'));
 assert.ok(!allowed.includes('fuel'));
 assert.ok(!allowed.includes('payroll'));
});
test('delegated HR manager sees HR/attendance/approval but not Finance',()=>{
 const allowed=screens('station','hr_manager');
 for(const section of ['hr','attendance','reviews','payroll'])assert.ok(allowed.includes(section));
 assert.ok(!allowed.includes('finance'));
});
test('invited organization manager and billing manager can open org billing',()=>{
 for(const role of ['organization_manager','billing_manager'])
  assert.ok(screens('organization',role).includes('billing'));
});
test('UI registers scoped HR/finance workspaces with role-specific station IDs',()=>{
 const src=readFileSync('src/client/main.js','utf8');
 assert.match(src,/const hrManager=memberships\.find/);
 assert.match(src,/const financeManager=memberships\.find/);
 assert.match(src,/register\('finance',\(\)=>qaFinanceMode\?/);
 assert.match(src,/stationFinanceWorkspace\(session\.access_token,stationId/);
 assert.match(src,/mountQaTopupApprovals\(/);
 assert.match(src,/register\('hr',\(\)=>hrWorkspace/);
});
