import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
const file=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const member=(scopeType,role,extra={})=>({scopeType,role,...extra});

test('Gentelella-inspired workspace groups navigation by task and never exposes hidden roles',()=>{
 const html=renderWorkspaceShell(selectWorkspaceScreens([member('platform','platform_superadmin')]));
 assert.match(html,/ws-nav-heading">จัดการแพลตฟอร์ม/);
 assert.match(html,/data-ws-go="stations"/);
 assert.match(html,/data-ws-go="billing"/);
 assert.doesNotMatch(html,/data-ws-go="pump"/);
 assert.doesNotMatch(html,/data-ws-go="hr"/);
 assert.match(html,/ws-section-heading/);
 assert.match(html,/ws-overview-columns/);
 assert.match(html,/id="scopes"/);
 assert.match(html,/id="modules"/);
 assert.match(html,/id="logout"/);
});
test('mobile drawer has valid toggles and keyboard dismissal',()=>{
 const source=file('src/client/workspace-layout.js');
 const html=renderWorkspaceShell(selectWorkspaceScreens([]));
 assert.match(html,/data-ws-menu-toggle/);
 assert.match(html,/aria-controls="ws-sidebar" aria-expanded="false"/);
 assert.match(html,/data-ws-menu-close/);
 assert.match(html,/aria-label="เมนูหลัก"/);
 assert.match(source,/event\.key==="Escape"/);
 assert.match(source,/closeMenu\(\)/);
 assert.match(source,/aria-current/);
 assert.doesNotMatch(html,/<main class="ws-content"/);
});
test('all navigation SVG placeholders are supported by the existing Lucide allowlist',()=>{
 const icons=file('src/client/icons.js');
 const map=icons.slice(icons.indexOf('const UI = Object.freeze({'),icons.indexOf('const BRANDS ='));
 const membership=[
  member('platform','platform_superadmin'),
  member('station','station_owner',{stationId:'station'}),
  member('organization','organization_owner',{organizationId:'org'}),
  member('corporate_company','corporate_admin',{corporateCompanyId:'company'}),
 ];
 const html=renderWorkspaceShell(selectWorkspaceScreens(membership));
 const declared=[...html.matchAll(/data-ui-icon="([^"]+)"/g)].map(x=>x[1]);
 assert.ok(declared.length>5);
 for(const name of declared){
  assert.ok(map.includes(name+':')||map.includes("'"+name+"':"),name+' was not allowlisted');
 }
});
test('Gentelella shell styling remains isolated from public login and respects mobility',()=>{
 const css=file('public/workspace-gentelella.css');
 const index=file('index.html');
 assert.match(index,/href="\/workspace-gentelella\.css"/);
 assert.match(css,/#app\.center\.workspace-mode/);
 assert.match(css,/body:has\(#app\.workspace-mode\)/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.ws-sidebar\.is-open/);
 assert.match(css,/\.saas-simple-layout/);
 assert.match(css,/\.os-price-grid/);
 assert.ok(!index.includes('gentelella.min.css'));
});
test('station management is split into creation and existing station tasks without choosing plan',()=>{
 const src=file('src/client/main.js');
 const start=src.indexOf('async function platformWorkspace(');
 const end=src.indexOf('function dashboard(',start);
 const section=src.slice(start,end);
 assert.match(section,/class="os-station-layout"/);
 assert.match(section,/id="new-station-form"/);
 assert.match(section,/id="station-list"/);
 assert.match(section,/id="station-count"/);
 assert.match(section,/className='os-station-actions'/);
 assert.match(section,/createInviteControl/);
 assert.match(section,/fuelPriceEditor/);
 assert.doesNotMatch(section,/planId|paymentMethod/);
});
test('plan group presents three separately controlled prices, preserving original payload',()=>{
 const src=file('src/client/platform-saas-billing.js');
 for(const expected of ['os-price-grid','couponBaht','hrBaht','bundleBaht',
  "submit('bundle-plan'", "rpc('archive-plan'"])
  assert.ok(src.includes(expected),expected);
 assert.match(src,/bundlePriceSatang/);
 assert.match(src,/เมื่อเปิดทั้ง 2 บริการ/);
});
