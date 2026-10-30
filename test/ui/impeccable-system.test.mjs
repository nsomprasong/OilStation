import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {humanizeApiError,setUiStatus} from '../../src/client/ui-status.js';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const identity=(scopeType,role,extra={})=>({scopeType,role,...extra});

test('Impeccable product and design files define truthful operating constraints',()=>{
 const product=read('PRODUCT.md'),design=read('DESIGN.md');
 assert.match(product,/impeccable:product-schema 1/);
 assert.match(product,/multi-tenant|หลาย/);
 assert.match(product,/NOT a payment/);
 assert.match(design,/Mode:\*\* Operate/);
 assert.match(design,/No fake payment success/);
});
test('shared design language covers every primary operational area and both guest/workspace',()=>{
 const css=read('public/impeccable.css');
 const index=read('index.html');
 for(const t of [
  '#app.workspace-mode','.ws-sidebar','.ws-screen','.field input','.button.primary',
  '.saas-plan-row','.owner-plan-card','.fuel-row','.finance-item',
  '.attendance-workspace','.plate-review-card','.fuel-review-card','.billing-panel',
  '.os-station-card','.notice','[role="alert"]','@media(max-width:620px)',
  '@media (pointer:coarse)','@media (forced-colors:active)','@media (prefers-reduced-motion:reduce)',
 ])assert.ok(css.includes(t),t);
 assert.match(css,/#app\.center:not\(\.workspace-mode\)/);
 assert.match(index,/href="\/impeccable\.css"/);
 assert.match(index,/href="#app" class="skip-workspace"/);
 assert.match(index,/viewport-fit=cover/);
 assert.doesNotMatch(index,/id="app" class="center" aria-live="polite"/);
});
test('all navigation actions are permission-filtered; no unsafe stored menu renders',()=>{
 const screens=selectWorkspaceScreens([identity('platform','platform_superadmin')]);
 assert.deepEqual(screens.map(s=>s.key),['overview','stations','billing']);
 const nav=renderWorkspaceShell(screens);
 assert.doesNotMatch(nav,/data-ws-go="finance"/);
 const source=read('src/client/main.js');
 assert.match(source,/\.find\(button=>button\.dataset\.wsGo===requested\)/);
 assert.match(source,/oilstation_last_workspace/);
 assert.match(source,/sessionStorage\.removeItem\('oilstation_last_workspace'\)/);
});
test('impeccable lazy-loading avoids eager network operations for hidden modules',()=>{
 const source=read('src/client/main.js');
 const block=source.slice(source.indexOf('function dashboard('),source.indexOf('async function couponViewer('));
 assert.match(block,/const mounts=new Map\(\),opened=new Set\(\)/);
 assert.match(block,/const mountScreen=key/);
 assert.match(block,/oilstation:screenchange/);
 for(const key of ['stations','fuel','billing','finance','customers','hr','pump','reviews','payroll','attendance','corporate','plan','invitations']){
  assert.ok(block.includes("register('"+key+"'"),key);
 }
 assert.match(block,/Promise\.resolve\(\)\.then\(fn\)\.catch/);
 assert.doesNotMatch(block,/platformWorkspace\(session\.access_token\)\.catch/);
});
test('mobile menu is excluded from tab order while closed and traps focus when open',()=>{
 const source=read('src/client/workspace-layout.js');
 assert.match(source,/menu\.inert=Boolean\(mobile\?\.matches&&!active\)/);
 assert.match(source,/event\.key==="Tab"/);
 assert.match(source,/event\.shiftKey/);
 assert.match(source,/event\.key==="Escape"/);
 assert.match(source,/first\.focus\(\)/);
 assert.match(source,/last\.focus\(\)/);
});
test('humanizeApiError provides safe Thai recovery; never shows backend codes',()=>{
 assert.match(humanizeApiError('unauthenticated'),/เข้าสู่ระบบ/);
 assert.match(humanizeApiError('permission_denied'),/สิทธิ์/);
 assert.match(humanizeApiError('plan_in_use'),/ลบไม่ได้/);
 assert.match(humanizeApiError('release_not_enabled'),/ยังไม่เปิด/);
 assert.equal(humanizeApiError('UNEXPECTED_SQL_PRIVATE_ERROR'),'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
 assert.equal(humanizeApiError(null),'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
});
test('setUiStatus exposes semantics without changing financial server outcomes',()=>{
 const node={textContent:'',dataset:{},hidden:true};
 setUiStatus(node,'สร้างคำเชิญแล้ว','success');
 assert.equal(node.textContent,'สร้างคำเชิญแล้ว');
 assert.equal(node.dataset.tone,'success');
 assert.equal(node.hidden,false);
 setUiStatus(node,'');
 assert.equal(node.hidden,true);
});
test('invitation tells accepted-by-provider from delivered, and fuel errors tell next step',()=>{
 const src=read('src/client/main.js');
 assert.match(src,/ยังไม่ยืนยันการส่งถึงผู้รับ/);
 assert.match(src,/กรุณาคัดลอกและส่งให้ผู้รับ/);
 assert.match(src,/toggle\.setAttribute\('aria-expanded'/);
 assert.match(src,/ราคาบาทต่อลิตรสำหรับ/);
 assert.match(src,/role','alert'/);
});
