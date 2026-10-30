import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authMarkup} from '../../src/client/auth-screen.js';
import {TASK_GROUPS,categoryFor,renderWorkspaceCategories} from '../../src/client/workspace-categories.js';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {installProgressiveWorkspace} from '../../src/client/progressive-workspace.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const station={scopeType:'station',role:'station_owner',stationId:'s'};
test('compact login and first-admin setup use real OAuth buttons with same teal identity',()=>{
 const login=authMarkup();
 const invited=authMarkup({invited:true});
 const setup=authMarkup({setup:true});
 assert.match(login,/os-auth-shell/);
 assert.match(login,/os-auth-hero/);
 assert.match(login,/os-auth-card/);
 for(const html of [login,invited,setup]){
  assert.match(html,/id="google"/);
  assert.match(html,/id="facebook"/);
  assert.match(html,/data-brand-icon="google"/);
  assert.match(html,/data-brand-icon="facebook"/);
  assert.match(html,/id="notice"/);
 }
 assert.match(invited,/ยืนยันคำเชิญ/);
 assert.match(setup,/ผู้ดูแลครั้งแรก/);
 assert.doesNotMatch(setup,/href="\/setup"/);
 assert.doesNotMatch(login,/class="step"/);
});
test('Google shows 4 actual brand colors and Facebook shows official blue',()=>{
 const src=read('src/client/icons.js');
 for(const token of ['#4285F4','#34A853','#FBBC05','#EA4335','#1877F2']){
  assert.ok(src.includes(token),token);
 }
 assert.match(src,/brand\.path/);
 assert.match(src,/brand-symbol/);
 assert.match(read('src/client/main.js'),/authMarkup\(\{invited\}\)/);
 assert.match(read('src/client/main.js'),/signInWithOAuth/);
});
test('six task groups remain permission-filtered and preserve server role boundaries',()=>{
 assert.equal(TASK_GROUPS.length,6);
 assert.equal(categoryFor('fuel'),'stations');
 assert.equal(categoryFor('hr'),'people');
 const platform=selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]);
 const html=renderWorkspaceCategories(platform,'billing');
 assert.match(html,/data-task-group="overview"/);
 assert.match(html,/data-task-group="stations"/);
 assert.match(html,/data-task-group="finance"/);
 assert.doesNotMatch(html,/data-ws-go="pump"/);
 assert.doesNotMatch(html,/data-ws-go="hr"/);
 assert.doesNotMatch(html,/data-task-group="people"/);
 const stationHtml=renderWorkspaceShell(selectWorkspaceScreens([station]));
 assert.match(stationHtml,/class="os-category-nav"/);
 assert.match(stationHtml,/data-task-group="people"/);
 assert.match(stationHtml,/data-ws-go="fuel"/);
});
test('floating add actions only target supported create flows and never cashier verification or finance approval',()=>{
 const src=read('src/client/progressive-workspace.js');
 assert.match(src,/stations:\{title:/);
 assert.match(src,/customers:\{title:/);
 assert.match(src,/hr:\{title:/);
 assert.match(src,/billing:\{title:/);
 assert.doesNotMatch(src,/pump:\{title:/);
 assert.doesNotMatch(src,/finance:\{title:/);
 assert.match(src,/surface\.hidden=true/);
 assert.match(src,/aria-expanded/);
 assert.match(src,/form\.querySelector/);
 assert.match(src,/form\.dataset\.osCreateReady/);
 assert.match(src,/installProgressiveWorkspace/);
 assert.match(src,/function secondaryHrTabs/);
 assert.match(src,/งานย่อยด้านบุคลากร/);
 assert.match(src,/hr-ot-request/);
 assert.equal(typeof installProgressiveWorkspace,'function');
});
test('editable fuel and VAT cards use existing controls, not simulated API actions',()=>{
 const src=read('src/client/progressive-workspace.js');
 assert.match(src,/fuel-row-controls/);
 assert.match(src,/os-card-edit/);
 assert.match(src,/saas-current-summary/);
 assert.match(src,/status\.dataset\.tone==='success'/);
 assert.match(src,/setAttribute\('aria-expanded'/);
 assert.doesNotMatch(src,/fetch\(/);
 assert.match(read('src/client/main.js'),/fuelPriceEditor/);
 assert.match(read('src/client/platform-saas-billing.js'),/vatMode/);
});
test('mobile FAB remains above bottom navigation and desktop inherits teal hero style',()=>{
 const css=read('public/oilstation-unified.css');
 const html=read('index.html');
 assert.ok(html.indexOf('/oilstation-unified.css')>html.indexOf('/mobile-app.css'));
 for(const selector of ['.os-add-fab','.os-card-edit','.os-category-nav','.os-auth-shell','.ws-toolbar']){
  assert.ok(css.includes(selector),selector);
 }
 assert.match(css,/bottom:calc\(101px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(css,/@media\(min-width:851px\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
