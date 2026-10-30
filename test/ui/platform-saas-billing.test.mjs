import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPlatformSaasBilling,formattedBaht} from '../../src/client/platform-saas-billing.js';
import {readFileSync} from 'node:fs';
test('platform SaaS UI offers only VAT policy and plan management',()=>{
 const src=readFileSync(new URL('../../src/client/platform-saas-billing.js',import.meta.url),'utf8');
 assert.equal(typeof mountPlatformSaasBilling,'function');
 for(const word of ['vatMode','ratePercent','flat-plan','couponPriceSatang','hrPriceSatang','แพ็กเกจที่มีอยู่','นโยบายภาษีมูลค่าเพิ่ม']){
  assert.ok(src.includes(word),word);
 }
 for(const removed of ["rpc('group'","rpc('subscription'","rpc('draft'","rpc('issue'","billing-group-station-choices","ตรวจร่างและออกใบแจ้งหนี้"]){
  assert.equal(src.includes(removed),false,removed);
 }
 assert.match(src,/บันทึกนโยบาย VAT/);
 assert.match(src,/สร้างแพ็กเกจ/);
});
test('plan prices render from server satang values without rounding discrepancies',()=>{
 assert.equal(formattedBaht('150000'),'1,500.00 บาท');
 assert.equal(formattedBaht('0'),'0.00 บาท');
 assert.equal(formattedBaht(undefined),'—');
});
test('owner plan selection is outside SaaS administration and station creation',()=>{
 const src=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 const a=src.indexOf('async function platformWorkspace('),b=src.indexOf('function dashboard(',a);
 const station=src.slice(a,b);
 assert.match(station,/createInviteControl/);
 assert.doesNotMatch(station,/planId|pricingPlanId|selectedPlanId/);
});
