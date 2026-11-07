import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const main=read('src/client/main.js');
const nav=read('src/client/functional-submenus.js');
const details=read('src/client/platform-station-details.js');
const css=read('public/oilstation.css');
const sql=read('supabase/migrations/20261107174500_station_operational_tax_profile.sql');
test('no ambiguous platform Fuel tab: only cards open a station-bound detail panel',()=>{
 const scope=main.slice(main.indexOf('async function platformWorkspace('),
  main.indexOf('function dashboard(',main.indexOf('async function platformWorkspace(')));
 assert.match(scope,/id="station-details-panel"/);
 assert.doesNotMatch(scope,/id="fuel-editor"/);
 assert.match(scope,/void openDetails\(s\)/);
 assert.match(scope,/fuelEditor:\(token,id,host\)=>fuelPriceEditor\(token,id,host,\{embedded:true\}\)/);
 assert.match(scope,/edit\.textContent='แก้ไขรายละเอียด'/);
 assert.match(scope,/headingPanel\.hidden=true;toolsPanel\.hidden=true;listPanel\.hidden=true/);
 assert.match(scope,/onBack:closeDetails/);
 assert.doesNotMatch(nav,/pane\('fuel','ตั้งค่าน้ำมัน'/);
});
test('Super Admin station tile is only station icon/title/brand, organization, actual service tags and Edit Details',()=>{
 assert.match(main,/className='os-station-card-head'/);
 assert.match(main,/className='os-station-card-organization'/);
 assert.match(main,/className='os-station-service-list'/);
 assert.match(main,/actions\.append\(edit\)/);
 assert.match(css,/\.os-station-card-head/);
 assert.match(css,/\.os-station-manage/);
});
test('details screen includes operational address/location/contacts and VAT invoice issuer',()=>{
 for(const key of ['stationName','address','postalCode','latitude','longitude',
  'contactName','stationPhone','stationEmail','invoiceIssuerName',
  'invoiceTaxId','invoiceBranchCode','invoiceAddress','invoicePhone',
  'invoiceEmail','vatRegistered']){
  assert.ok(details.includes(key),'missing profile field '+key);
 }
 assert.match(details,/ข้อมูลผู้ออกใบกำกับภาษี/);
 assert.match(details,/จดทะเบียนภาษีมูลค่าเพิ่ม/);
 assert.match(details,/ไม่ใช่การออกใบกำกับภาษีอัตโนมัติ/);
 assert.match(details,/getApi\('\/api\/platform\/station-profile\/update'/);
 assert.match(details,/profile\.stationId!==station\.id/);
 assert.match(details,/await fuelEditor\(token,station\.id,fuelBody\)/);
});
test('tax data only in a station-id-scoped private table with platform-only RLS-controlled RPCs',()=>{
 assert.match(sql,/station_operational_profiles/);
 assert.match(sql,/station_id uuid PRIMARY KEY REFERENCES public\.stations\(id\)/);
 assert.match(sql,/ALTER TABLE public\.station_operational_profiles FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.platform_read_station_profile/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.platform_update_station_profile/);
 assert.match(sql,/m\.role_code='platform_superadmin'/);
 assert.match(sql,/station_profile_updated/);
 assert.match(sql,/hasInvoiceTaxId/);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|EXECUTE).* TO authenticated/);
});
