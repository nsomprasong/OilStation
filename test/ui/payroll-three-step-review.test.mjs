import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/client/attendance-payroll-preview.js',import.meta.url),'utf8');

test('payroll time review has a fast three-step employee/month/review workflow',()=>{
 for(const piece of ['1 · เลือกพนักงาน','2 · เลือกงวด','3 · ตรวจสรุปเวลาทำงาน',
  'เดือนนี้','เดือนก่อน','กำหนดช่วงวันเอง','dateCaption','setMonth(0)',
  'timeZone:\'Asia/Bangkok\''])assert.ok(source.includes(piece),piece);
});
test('review-only UI never exposes pay, bank export or payroll approval endpoint',()=>{
 assert.match(source,/result\.payable!==false/);
 assert.match(source,/result\.faceVerified!==false/);
 assert.match(source,/result\.status!=='preview_only'/);
 assert.match(source,/ยังไม่ใช่รายการจ่ายเงินเดือน/);
 assert.match(source,/ไม่สามารถโอนหรือกดอนุมัติเงินได้/);
 assert.doesNotMatch(source,/\/api\/payroll\/(approve|pay|export|transfer)/);
});
test('quick preview keeps incomplete-punch handling and one summary result',()=>{
 assert.match(source,/end\.value<=start\.value/);
 assert.match(source,/ยังคำนวณไม่ได้/);
 assert.match(source,/resultCard\.hidden=true/);
 assert.match(source,/resultCard\.hidden=false/);
 assert.match(source,/reload\.disabled=true/);
});
