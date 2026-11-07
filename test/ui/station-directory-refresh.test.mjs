import test from 'node:test';
import assert from 'node:assert/strict';
import {filterStationDirectory,stationEnabledModules,stationServiceStatus} from '../../src/client/station-directory-model.js';
import {readFileSync} from 'node:fs';

const a={id:'a',stationName:'QA-S01-A',organizationName:'บริษัท เอเมอรัลด์',brandName:'PTT Station',
 modules:{qr_coupon:'enabled',hr_payroll:'enabled'}};
const b={id:'b',stationName:'QA-S02-B',organizationName:'ทดสอบ บี',brandName:'Shell',
 modules:{qr_coupon:'enabled',hr_payroll:'disabled'}};
const c={id:'c',stationName:'ปั๊มใหม่',organizationName:'ทดลอง',brandName:'บางจาก',
 modules:{qr_coupon:'disabled',hr_payroll:'pending'}};
const rows=[a,b,c];

test('service filter uses actual module states rather than guessing owner invitation status',()=>{
 assert.deepEqual(stationEnabledModules(a),['qr_coupon','hr_payroll']);
 assert.equal(stationServiceStatus(b),'enabled');
 assert.equal(stationServiceStatus(c),'inactive');
 assert.deepEqual(filterStationDirectory(rows,{filter:'enabled'}).map(x=>x.id),['a','b']);
 assert.deepEqual(filterStationDirectory(rows,{filter:'inactive'}).map(x=>x.id),['c']);
 assert.deepEqual(filterStationDirectory(rows,{filter:'qr'}).map(x=>x.id),['a','b']);
 assert.deepEqual(filterStationDirectory(rows,{filter:'hr'}).map(x=>x.id),['a']);
 assert.equal(filterStationDirectory(rows,{filter:'all'}).length,3);
});
test('Thai search includes organization, station and brand and does not change original rows',()=>{
 assert.deepEqual(filterStationDirectory(rows,{query:'เอเมอรัลด์'}).map(x=>x.id),['a']);
 assert.deepEqual(filterStationDirectory(rows,{query:'qa-s02'}).map(x=>x.id),['b']);
 assert.deepEqual(filterStationDirectory(rows,{query:'บางจาก'}).map(x=>x.id),['c']);
 assert.deepEqual(filterStationDirectory(rows,{query:'ไม่มี'}),[]);
 assert.deepEqual(rows.map(x=>x.id),['a','b','c']);
});

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const main=read('src/client/main.js');
const css=read('public/oilstation.css');
const progressive=read('src/client/progressive-workspace.js');
const submenus=read('src/client/functional-submenus.js');
const toolbar=read('src/client/toolbar-credit.js');
const profile=read('src/client/user-profile.js');

test('station screen has one page hero, a count, one search and a real service filter',()=>{
 assert.match(main,/class="os-station-directory-heading"/);
 assert.match(main,/id="station-query" type="search"/);
 assert.match(main,/id="station-filter"/);
 assert.match(main,/id="station-count"/);
 assert.match(main,/aria-busy="true"/);
 assert.doesNotMatch(main,/<span class="os-onboarding-label">\$\{salesMode\?'ขั้นตอนที่ 2/);
 assert.match(submenus,/if\(taskTitles\.has\(key\)&&key!=='stations'\)/);
});
test('page header create action preserves real add flow and removes fixed station FAB',()=>{
 assert.match(progressive,/if\(key==='stations'\)/);
 assert.match(progressive,/heading\.append\(action\)/);
 assert.match(progressive,/action\.addEventListener\('click',\(\)=>fab\.click\(\)\)/);
 assert.match(progressive,/form\.addEventListener\('os:create-show'/);
 assert.match(css,/\[data-ws-screen="stations"\]>\.os-add-fab\{\s*display:none!important/);
 assert.match(css,/\.os-station-create-cta/);
});
test('station cards use colored emerald header, gold button, truthful status and all role actions',()=>{
 assert.match(main,/className='os-station-card-head'/);
 assert.match(main,/className='os-station-card-body'/);
 assert.match(main,/className='os-station-service-list'/);
 assert.match(main,/createInviteControl\(accessToken,'organization'/);
 assert.match(main,/createInviteControl\(accessToken,'station'/);
 assert.match(main,/fuelPriceEditor\(accessToken,s\.id,editor\)/);
 assert.match(css,/\.os-station-card-head\{/);
 assert.match(css,/background-image:linear-gradient\(110deg,#143A2D/);
 assert.match(css,/background:linear-gradient\(120deg,#E5D4A8,#C9AB74\)/);
 assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,235px\),1fr\)\)/);
});
test('Super Admin header hides unrelated credit and translates the actual role',()=>{
 assert.match(toolbar,/scope\.kind==='driver'\|\|scope\.kind==='unlinked'/);
 assert.match(profile,/platform_superadmin:'ผู้ดูแลระบบสูงสุด'/);
 assert.match(profile,/subtitle\.textContent=displayRole/);
});
test('empty search and transient error have accessible feedback without hardcoded stations',()=>{
 assert.match(main,/โหลดรายการปั๊มไม่สำเร็จ กรุณาลองใหม่/);
 assert.match(main,/retry\.addEventListener\('click'/);
 assert.match(main,/ไม่พบปั๊มที่ตรงกับการค้นหา/);
 assert.match(main,/search\.addEventListener\('input',renderStations\)/);
 assert.match(main,/filter\.addEventListener\('change',renderStations\)/);
});
