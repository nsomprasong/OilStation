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

test('existing-subscription plan change is preview-only, never POSTs a replacement',()=>{
 const source=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');
 assert.match(source,/previewSubscriptionPlanChange/);
 assert.match(source,/currentPlanId:currentTerm\.planId,nextPlanId:chosen\.id/);
 assert.match(source,/requestedStartOn:switchDate\.value\|\|null/);
 assert.match(source,/nowUtc:new Date\(\)\.toISOString\(\)/);
 assert.match(source,/switchPreview\.hidden=!activeSubscription/);
 assert.match(source,/if\(!current\|\|activeSubscription\)return/);
 assert.match(source,/button\.disabled=activeSubscription/);
 assert.match(source,/ยังไม่บันทึกคำขอ ไม่เปลี่ยนสิทธิ์ และไม่ตัดเงิน/);
 assert.doesNotMatch(source,/\/api\/station\/billing\/(?:switch|schedule|activate|cancel)/);
});

test('future renewal preview requires actual subscription anchor; do not infer it from a clamped month end',()=>{
 const source=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');
 assert.match(source,/switchDate\.value&&\(!Number\.isInteger\(currentTerm\.anchorDay\)/);
 assert.match(source,/anchorDay:currentTerm\.anchorDay\|\|end\.getUTCDate\(\)/);
 assert.match(source,/ไม่มีข้อมูลวันยึดรอบต่ออายุจากเซิร์ฟเวอร์/);
});

test('station owner sees only server-scoped readonly SaaS transition history',()=>{
 const source=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');
 assert.match(source,/Array\.isArray\(result\.recentChanges\)/);
 assert.match(source,/recentChanges\.hidden=changes\.length===0/);
 assert.match(source,/shapeSaasOwnerChangeHistory/);
 assert.match(source,/change\.name/);
 assert.match(source,/day\(change\.effectiveAt\)/);
 assert.match(source,/ประวัติคำขอเปลี่ยนแพ็กเกจ \(อ่านอย่างเดียว\)/);
 assert.doesNotMatch(source,/\/api\/station\/billing\/(?:schedule|change-request|cancel-change)/);
});
