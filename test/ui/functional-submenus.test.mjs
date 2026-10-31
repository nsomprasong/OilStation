import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceCategories} from '../../src/client/workspace-categories.js';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {installFunctionalSubmenus} from '../../src/client/functional-submenus.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const panels=['sales','stations','billing','customers','hr','corporate','fuel','pump','finance','plan',
  'attendance','reviews','payroll','activity','invitations'];

test('every functional workspace has a declared compact submenu, not a cross-module main nav',()=>{
 const s=read('src/client/functional-submenus.js');
 assert.equal(typeof installFunctionalSubmenus,'function');
 for(const key of panels)
  assert.match(s,new RegExp('(?:\\s|^)'+key+':\\{kind:'),key);
 const shell=renderWorkspaceShell(selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]));
 assert.match(shell,/data-os-functional-menu/);
 assert.match(shell,/ws-context-host/);
 assert.equal(renderWorkspaceCategories([], 'overview'),'');
 const nav=renderWorkspaceCategories([], 'sales');
 assert.doesNotMatch(nav,/data-ws-go=|data-task-group=/);
});
test('Sales turns eight top-level functional cards into eight compact tabs',()=>{
 const s=read('src/client/functional-submenus.js');
 for(const label of ['เชิญเซลล์','ทีมขาย','ปั๊มที่รับผิดชอบ','ย้ายการดูแล',
  'ตรวจสอบปั๊ม','ลูกค้าที่ชำระแล้ว','ค่าคอมมิชชั่น','ประวัติการดูแล'])
  assert.ok(s.includes(label),label);
 assert.match(s,/selector:':scope > section.os-sales-panel'/);
 assert.match(s,/start:'assignment'/);
 assert.doesNotMatch(s,/selector:'.*os-sales-card/);
 assert.match(read('src/client/platform-sales.js'),/oilstation:open-pane/);
});
test('all per-screen functional tabs are exclusive, preserve loaded nodes and restore selection',()=>{
 const s=read('src/client/functional-submenus.js');
 for(const token of ['p.wrapper.hidden','state.selected','wrap.append(node)','new MutationObserver',
  'aria-current','data-os-pane-key','installFunctionalSubmenus',
  'oilstation:open-pane','state.signature'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/replaceChildren\(\).*form/);
 assert.doesNotMatch(s,/data-ws-go=/);
 const css=read('public/functional-submenus.css');
 assert.match(css,/\.os-functional-pane\[hidden\]/);
 assert.match(css,/display:none!important/);
 assert.match(css,/flex-flow:row nowrap/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.ok(read('index.html').lastIndexOf('functional-submenus.css')>read('index.html').lastIndexOf('navigation-standard.css'));
});
test('Billing plans, editor and VAT are separate tabs; Add/Edit switches to editor',()=>{
 const s=read('src/client/functional-submenus.js');
 assert.match(s,/pane\('plans','รายการแพ็กเกจ'/);
 assert.match(s,/pane\('editor','เพิ่มหรือแก้ไขแพ็กเกจ'/);
 assert.match(s,/pane\('tax','นโยบาย VAT'/);
 const manager=read('src/client/saas-plan-manager.js');
 assert.match(manager,/detail:\{key:'editor'\}/);
 assert.match(manager,/detail:\{key:'plans'\}/);
 assert.match(read('src/client/progressive-workspace.js'),/oilstation:open-pane/);
});
test('data records, fuel rows, finance items and required Pump verification remain within their task, not nav items',()=>{
 const s=read('src/client/functional-submenus.js');
 assert.doesNotMatch(s,/\.fuel-row|\.finance-item|\.saas-plan-row|\.os-sales-card/);
 assert.match(s,/pump:\{kind:'single',label:'สแกนและตรวจคูปอง'/);
 assert.match(s,/fuel:\{kind:'single',label:'ชนิดและราคาน้ำมัน'/);
 assert.match(s,/corporate:\{kind:'ranges'/);
 assert.match(s,/hr:\{kind:'ranges'/);
 const main=read('src/client/main.js');
 assert.match(main,/installFunctionalSubmenus\(root\)/);
 assert.match(main,/plate-photo-form|scan-form/);
 assert.doesNotMatch(read('src/client/progressive-workspace.js'),/function secondaryHrTabs/);
});
