import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
test('plan payment selection appears only after accepted station-owner membership',()=>{
 const station={scopeType:'station',stationId:'station',role:'station_owner'};
 const yes=selectWorkspaceScreens([station]).map(x=>x.key);
 assert.ok(yes.includes('plan'));
 assert.ok(!selectWorkspaceScreens([{...station,role:'cashier'}]).some(x=>x.key==='plan'));
 assert.ok(!selectWorkspaceScreens([{...station,stationId:null}]).some(x=>x.key==='plan'));
});
test('station creation requires no selected plan or payment method',()=>{
 const source=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 const section=source.slice(source.indexOf('async function platformWorkspace('),source.indexOf('function dashboard('));
 assert.match(section,/เชิญเจ้าของปั๊ม/);
 assert.doesNotMatch(section,/selectedPlanId|pricingPlanId|paymentMethod/);
});
test('owner chooser stores plan and method without client-submitted price or charging card',()=>{
 const source=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');
 assert.match(source,/\/api\/station\/billing\/select/);
 assert.match(source,/planId:current,paymentMethod:selectedMethod\(\)/);
 assert.match(source,/ยังไม่ตัดเงิน/);
 assert.doesNotMatch(source,/stripe\.confirmPayment|amountSatang:/gi);
});
