import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {renderMobileNav} from '../../src/client/mobile-home.js';
import {renderWorkspaceCategories} from '../../src/client/workspace-categories.js';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const keys=memberships=>selectWorkspaceScreens(memberships).map(s=>s.key);

test('Forest Gold platform and station navigation remains strictly role-filtered',()=>{
 const platform=[{scopeType:'platform',role:'platform_superadmin'}];
 const station=[{scopeType:'station',role:'station_owner',stationId:'station-a'}];
 const cashier=[{scopeType:'station',role:'cashier',stationId:'station-a'}];
 const p=keys(platform),s=keys(station),c=keys(cashier);
 for(const key of ['overview','sales','activity','stations','billing'])
  assert.ok(p.includes(key),'platform lacks '+key);
 for(const key of ['plan','fuel','pump','customers','finance','hr','attendance','reviews','payroll','invitations'])
  assert.ok(s.includes(key),'station lacks '+key);
 for(const key of ['customers','finance','hr','payroll','stations','sales','billing'])
  assert.ok(!c.includes(key),'cashier gained '+key);
 assert.ok(c.includes('pump'));
 assert.ok(!p.includes('finance'));
 assert.ok(!s.includes('sales'));
 const main=renderWorkspaceShell(selectWorkspaceScreens(platform));
 assert.match(main,/os-desktop-side-nav/);
 assert.match(main,/ws-context-host/);
 assert.ok(main.indexOf('ws-context-host')<main.indexOf('id="ws-content"'));
 assert.match(main,/os-mobile-bottom/);
 assert.doesNotMatch(renderWorkspaceCategories(selectWorkspaceScreens(station),'customers'),/data-ws-go=/);
});

test('Forest Gold applies one contextual menu per real Platform/Station workspace',()=>{
 const submenus=read('src/client/functional-submenus.js');
 for(const key of ['support','sales','activity','stations','billing','plan',
  'fuel','pump','customers','finance','hr','attendance','reviews','payroll','invitations']){
  assert.match(submenus,new RegExp('(?:\\s|^)'+key+':\\{kind:'),'missing submenu '+key);
 }
 for(const token of [
  "const taskTitles=new Set(['sales','stations','billing','customers','hr'])",
  "if(taskTitles.has(key)&&key!=='stations')",'heading.textContent=found.label',
  "description.textContent=copy",'p.wrapper.hidden','state.selected=id'
 ])assert.ok(submenus.includes(token),'missing task/state contract: '+token);
 assert.match(submenus,/isAvailable=\(state,p\)=>/);
 assert.match(submenus,/data-os-pane-key/);
 assert.doesNotMatch(submenus,/data-ws-go=/);
});

test('Forest Gold canonical CSS uses separated card layers and consistent nav controls',()=>{
 const css=read('public/oilstation.css');
 for(const token of [
  '--os-inset-gap:8px','--os-card-gap:12px','--os-task-gap:16px',
  'border-radius:var(--os-r)!important',
  'border-radius:var(--os-r-sm)!important',
  'scroll-snap-type:x proximity',
  'scroll-snap-align:start',
  'os-desktop-side-link:focus-visible',
  '.os-category-tab .os-nav-orb',
  '.ws-layout:not([data-active-screen="overview"])',
  '[data-ws-screen="support"] .os-support-table-scroll',
  '[data-ws-screen="activity"] .os-activity-table-wrap',
  '[data-ws-screen="customers"] :is(.os-credit-head,.os-report-header)',
  'os-mobile-dock-inner'
 ])assert.ok(css.includes(token),'missing style '+token);
 assert.doesNotMatch(css,/border-radius:14px!important;[\s\S]{0,100}box-shadow:0 4px 18px/);
 assert.match(read('index.html'),/href="\/oilstation\.css"/);
 assert.doesNotMatch(read('index.html'),/component-patterns\.css/);
});

test('Support reports scroll inside a card and keep read-only action scope',()=>{
 const src=read('src/client/platform-support.js');
 assert.match(src,/os-support-toolbar/);
 assert.match(src,/os-support-table-scroll/);
 assert.match(src,/tableScroll\.append\(table\)/);
 assert.match(src,/wrap\.append\(toolbar,status,label,list,eventLabel,tableScroll\)/);
 assert.match(src,/result\?\.readOnly!==true/);
 assert.doesNotMatch(src,/method:'POST'|method:"POST"/);
});

test('Mobile nav stays a centered five-position authorized dock',()=>{
 const station=selectWorkspaceScreens([{scopeType:'station',role:'station_owner',stationId:'station-a'}]);
 const dock=renderMobileNav(station,{pump:5,hr:4,fuel:3,customers:2,finance:1});
 assert.equal((dock.match(/class="os-mobile-tab /g)||[]).length,5);
 assert.match(dock,/os-mobile-dock-inner/);
 assert.match(dock,/data-ws-go="overview"/);
 assert.doesNotMatch(dock,/data-ws-go="sales"/);
 const css=read('public/oilstation.css');
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/max-width:540px/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
});
