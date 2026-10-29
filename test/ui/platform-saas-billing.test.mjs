import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPlatformSaasBilling} from '../../src/client/platform-saas-billing.js';
import {readFileSync} from 'node:fs';
test('Thai platform billing UI supports reviewed invoice issuance and owner setup',()=>{
 const src=readFileSync(new URL('../../src/client/platform-saas-billing.js',import.meta.url),'utf8');
 assert.equal(typeof mountPlatformSaasBilling,'function');
 for(const s of ['tax','flat-plan','group','subscription','draft','issue','billing-group-station-choices',
   'ตรวจราคา ภาษี และส่วนลด']){
  assert.ok(src.includes(s),s);
 }
 assert.match(src,/checkbox\.addEventListener\('change'/);
 assert.match(src,/button\.disabled=!checkbox\.checked/);
});
test('drafting uses only group, service window and payment method: no client amount',()=>{
 const src=readFileSync(new URL('../../src/client/platform-saas-billing.js',import.meta.url),'utf8');
 assert.match(src,/billingGroupId:d\.get\('billingGroupId'\)/);
 assert.match(src,/couponPriceSatang=currencyToSatang/);
 assert.match(src,/organizationId:d\.get\('organizationId'\)/);
 assert.doesNotMatch(src,/stripe\.confirmPayment/);
});


test('paid invoice commission button reads preview only, never issues payout',()=>{
 const src=readFileSync(new URL('../../src/client/platform-saas-billing.js',import.meta.url),'utf8');
 assert.match(src,/api\/platform\/billing\/commission-preview/);
 assert.match(src,/invoice\.status==='paid'/);
 assert.match(src,/ยังไม่ได้ลงบัญชีหรืออนุมัติจ่าย/);
 assert.doesNotMatch(src,/api\/platform\/billing\/commission\/payout/);
});
