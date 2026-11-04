import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountFuelReport,mountStationCustomerCredit} from '../../src/client/station-customer-reports.js';
import {mountUserProfile} from '../../src/client/user-profile.js';
import {mountMemberDirectory} from '../../src/client/member-directory.js';
import {mountHrEmployeeTable} from '../../src/client/hr-employee-table.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('scoped reports, credit, directory, profile and HR table are live components',()=>{
 for(const fn of [mountFuelReport,mountStationCustomerCredit,mountUserProfile,
  mountMemberDirectory,mountHrEmployeeTable])assert.equal(typeof fn,'function');
 const main=read('src/client/main.js');
 for(const x of ['/api/station/customer-overview','/api/fuel/report',
  'corp-remaining-credit','station-customer-credit','station-fuel-report-workspace',
  'company-fuel-report','hr-employee-table','mountUserProfile','mountMemberDirectory'])
  assert.ok((main+read('src/client/station-customer-reports.js')+
   read('src/client/member-invitations.js')).includes(x),x);
 assert.match(main,/roster\.employees\.filter\(x=>x\.employmentStatus==='active'\)/);
});
test('visual layout uses one project token system, inset cards and icon logout',()=>{
 const css=read('public/oilstation.css');
 const shell=read('src/client/workspace-layout.js');
 assert.match(css,/--os-r:16px;\s*--os-r-sm:12px;\s*--os-control-r:10px/);
 assert.match(css,/--os-section-pad:20px/);
 assert.match(css,/\.os-directory-controls\{display:block/);
 assert.match(css,/\.os-directory-dialog\{/);
 assert.match(css,/\.ws-widget>section>\.module-item\{[\s\S]*?margin-inline:8px/);
 for(const x of ['os-credit-grid','os-report-table','os-directory-table',
  'os-profile-panel','os-credit-banner','os-directory-actions'])assert.ok(css.includes(x),x);
 assert.match(shell,/class="os-toolbar-logout" data-mobile-logout[\s\S]*?data-ui-icon="logout"/);
 assert.match(shell,/id="os-toolbar-profile"/);
 assert.match(read('src/client/user-profile.js'),/setAttribute\('aria-expanded'/);
 const directory=read('src/client/member-directory.js');
 assert.match(directory,/memberRoleLabel/);
 assert.match(directory,/ผู้ดูแลบริษัท/);
 assert.match(directory,/sort\(/);
 assert.match(directory,/dialog\.showModal\(\)/);
 assert.match(directory,/makeIcon\('shield'\)/);
 assert.match(directory,/driver_has_active_coupon/);
 assert.doesNotMatch(directory,/removeChild\(|DELETE FROM|window\.confirm/);
});
test('sensitive data is not invented; SQL never modifies credit nor hard-deletes users',()=>{
 const sql=read('supabase/migrations/20261104110000_station_credit_plate_report_member_directory.sql');
 for(const func of ['oilstation_station_customer_overview',
  'oilstation_fuel_report_by_plate','oilstation_scoped_member_directory',
  'oilstation_scoped_member_change','oilstation_hr_employee_change'])
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+func));
 assert.match(sql,/fs\.status='completed'/);
 assert.match(sql,/a\.station_id=p_station_id/);
 assert.match(sql,/a\.company_id=p_company_id/);
 assert.match(sql,/SET search_path = ''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.oilstation_scoped_member_change/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.oilstation_scoped_member_change[^\n]+TO service_role/);
 assert.doesNotMatch(sql,/DELETE FROM\s+public\.(?:memberships|employees|app_users|wallet_ledger)/i);
 assert.doesNotMatch(sql,/UPDATE\s+public\.corporate_station_accounts/i);
 assert.match(sql,/FUTURE_SHIFT_EXISTS/);
 assert.match(sql,/DRIVER_HAS_ACTIVE_COUPON/);
});

test('the single workspace page header and menu gradients share one canonical stylesheet',()=>{
 const css=read('public/oilstation.css');
 const layout=read('src/client/workspace-layout.js');
 const members=read('src/client/member-invitations.js');
 for(const name of ['--os-gradient-page:','--os-gradient-menu:','--os-gradient-header:','--os-gradient-gold:'])
  assert.ok(css.includes(name),name);
 assert.match(css,/\.ws-layout\{[^\n]*background-image:var\(--os-gradient-page\)/);
 assert.match(css,/\.os-desktop-sidebar\{[\s\S]*?background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/\.os-mobile-bottom\{[\s\S]*?background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/\.ws-screen:not\(\[data-ws-screen="overview"\]\)>\.ws-screen-head\{/);
 assert.match(css,/background-image:var\(--os-gradient-header\)/);
 assert.match(layout,/s.key==="invitations"\?"":/);
 assert.match(members,/el\('div','os-member-actions'\)/);
 assert.doesNotMatch(members,/os-member-toolbar-title|os-member-list-head/);
 assert.doesNotMatch(css,/\.os-member-toolbar\{|\.os-member-list-head\{/);
});

test('member directory uses one search field and embedded magnifying glass',()=>{
 const c=read('src/client/member-directory.js'),css=read('public/oilstation.css');
 assert.match(c,/controls=node\('form','os-directory-controls'\)/);
 assert.match(c,/actionButton\('search','ค้นหาสมาชิก'/);
 assert.match(c,/controls\.addEventListener\('submit'/);
 assert.doesNotMatch(c,/const (?:role|state|order)=node\('select'/);
 assert.match(css,/\.os-member-directory-host\{[^}]*padding-top:18px/);
 assert.match(css,/\.os-directory-search-submit\{/);
 assert.doesNotMatch(css,/\.os-directory-refresh\{/);
});
