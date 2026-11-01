import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../../e2e/qa.fuel-complete.pw.mjs',import.meta.url),'utf8');
test('fuel QA never reuses completed fixed coupon, issues new TEST-only QR and checks reserve/settlement',()=>{
 assert.doesNotMatch(code,/const COUPON=/);
 assert.match(code,/randomUUID\(\)\.replaceAll\('-',\s*''\)/);
 assert.match(code,/post\(corporate,ct,'\/api\/coupons'/);
 assert.match(code,/couponId=qrPayload\.split\('\.'\)\[0\]/);
 assert.match(code,/balanceBeforeHold-MAX/);
 assert.match(code,/balanceBeforeHold-netExpected/);
 assert.match(code,/\/api\/qa\/finance\/topup\/request/);
 assert.match(code,/\/api\/qa\/finance\/topup\/review/);
 assert.match(code,/driverFixture/);
 assert.match(code,/photoId/);
 assert.match(code,/approved:true/);
});
