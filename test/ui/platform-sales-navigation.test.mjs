import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {renderMobileHome,renderMobileNav} from '../../src/client/mobile-home.js';
import {renderWorkspaceCategories} from '../../src/client/workspace-categories.js';
import {mountPlatformSales} from '../../src/client/platform-sales.js';
const read=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
const screens=role=>selectWorkspaceScreens([{scopeType:'platform',role}]);
test('sales has exactly a private work area while platform superadmin manages the whole sales team',()=>{
 assert.deepEqual(screens('platform_sales').map(s=>s.key),['overview','sales','activity']);
 assert.deepEqual(screens('platform_superadmin').map(s=>s.key),['overview','sales','activity','stations','billing']);
 assert.ok(!screens('platform_support').some(s=>s.key==='sales'));
 assert.match(renderWorkspaceShell(screens('platform_sales')),/id="platform-sales-workspace"/);
 assert.equal(typeof mountPlatformSales,'function');
 const main=read('src/client/main.js');
 assert.match(main,/createInviteControl\(session\.access_token,'platform',null/);
 assert.match(main,/register\('sales'/);
});
test('Home shows all tasks and the contextual menu never shows other categories',()=>{
 const p=screens('platform_superadmin');
 const home=renderMobileHome(p);
 for(const key of ['sales','stations','billing'])assert.match(home,new RegExp('data-ws-go="'+key+'"'));
 const contextual=renderWorkspaceCategories(p,'sales');
 assert.match(contextual,/data-ws-go="sales"/);
 assert.doesNotMatch(contextual,/data-ws-go="billing"/);
 assert.doesNotMatch(renderWorkspaceCategories(p,'overview'),/os-category-nav/);
 const layout=renderWorkspaceShell(p);
 assert.match(layout,/data-mobile-logout/);
 assert.match(layout,/os-toolbar-logout/);
});
test('bottom nav has no hamburger; only Home exposes full menu',()=>{
 const nav=renderMobileNav(screens('platform_superadmin'));
 assert.doesNotMatch(nav,/data-ws-more|data-ws-menu-toggle/);
 assert.match(nav,/data-ws-go="overview"/);
 assert.equal((nav.match(/class="os-mobile-tab/g)||[]).length,4);
 const css=read('public/platform-sales-navigation.css');
 assert.match(css,/display:none!important/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(read('index.html'),/platform-sales-navigation\.css/);
});
test('commission screen uses ledger and entitlement values; no fabricated payout or arbitrary HTML',()=>{
 const ui=read('src/client/platform-sales.js');
 for(const token of ['entitlementSatang','recordedLedgerSatang','collectedCustomers','assignment','salesId','stationId','reason','pendingInvitations','isAdmin'])
  assert.ok(ui.includes(token),token);
 assert.doesNotMatch(ui,/innerHTML|document\.write|รายได้ที่จ่ายแล้ว/);
 assert.match(ui,/เชิญเซลล์เข้าสู่ระบบ/);
 assert.match(ui,/การเปลี่ยนผู้ดูแลมีผลเที่ยงคืนวันถัดไป/);
 const worker=read('src/worker.mjs');
 assert.match(worker,/createPlatformSalesApi/);
 assert.match(worker,/\/api\/platform\/sales\/workspace/);
 assert.match(worker,/\/api\/platform\/sales\/transfer/);
});
