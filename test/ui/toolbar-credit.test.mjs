import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toolbarCreditScope,formatCreditSatang,mountToolbarCredit} from '../../src/client/toolbar-credit.js';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {renderMobileNav} from '../../src/client/mobile-home.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('credit header respects company/station roles; driver excluded',()=>{
 assert.equal(toolbarCreditScope([{scopeType:'corporate_company',role:'driver',corporateCompanyId:'x'}]).kind,'driver');
 assert.deepEqual(toolbarCreditScope([{scopeType:'corporate_company',role:'accountant',corporateCompanyId:'x'}]),{kind:'corporate',ids:['x']});
 assert.deepEqual(toolbarCreditScope([{scopeType:'station',role:'cashier',stationId:'s'}]),{kind:'station',ids:['s']});
 assert.equal(toolbarCreditScope([{scopeType:'station',role:'pump_staff',stationId:'s'}]).kind,'unlinked');
 assert.equal(typeof mountToolbarCredit,'function');
});
test('satang formatting is precise and missing values are not zero',()=>{
 assert.equal(formatCreditSatang('0'),'฿0.00');
 assert.equal(formatCreditSatang('1234567'),'฿12,345.67');
 assert.equal(formatCreditSatang('abc'),'—');
 assert.equal(formatCreditSatang(null),'—');
});
test('toolbar replaces search with permission-scoped credit and profile',()=>{
 const shell=renderWorkspaceShell(selectWorkspaceScreens([{scopeType:'station',role:'station_owner',stationId:'s'}]));
 assert.match(shell,/id="os-toolbar-credit"/);
 assert.match(shell,/id="os-toolbar-profile"/);
 assert.doesNotMatch(shell,/data-desktop-search|os-desktop-toolbar-label|WORKSPACE<\/span>/);
 assert.match(read('src/client/main.js'),/mountToolbarCredit\(/);
 assert.match(read('src/client/toolbar-credit.js'),/cache:'no-store'/);
 assert.match(read('src/client/toolbar-credit.js'),/scope\.ids\.includes\(a\.companyId\)/);
});
test('mobile nav is centered and keeps five slots with username visible',()=>{
 const nav=renderMobileNav(selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]));
 assert.match(nav,/os-mobile-dock-inner/);
 assert.equal((nav.match(/class="os-mobile-tab /g)||[]).length,5);
 const css=read('public/oilstation.css');
 assert.match(css,/\.os-mobile-dock-inner\{[^}]*margin-inline:auto/);
 assert.doesNotMatch(css,/#app\.workspace-mode \.os-profile-summary\{display:none\}/);
});
