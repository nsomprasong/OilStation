import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAttendancePayrollPreview} from '../../src/client/attendance-payroll-preview.js';
import {readFileSync} from 'node:fs';
test('manager preview loads scoped employee selector, handles station-local date boundaries',()=>{
 assert.equal(typeof mountAttendancePayrollPreview,'function');
 const s=readFileSync(new URL('../../src/client/attendance-payroll-preview.js',import.meta.url),'utf8');
 assert.match(s,/api\/hr\/roster\?stationId=/);
 assert.match(s,/api\/hr\/attendance\/payroll-preview/);
 assert.match(s,/startDate:start\.value,endDate:end\.value/);
 assert.match(s,/end\.value<=start\.value/);
 assert.match(s,/ตัวอย่างเพื่อทบทวนเท่านั้น/);
});
test('unapproved time or verified-face claims cannot be treated as payable',()=>{
 const s=readFileSync(new URL('../../src/client/attendance-payroll-preview.js',import.meta.url),'utf8');
 assert.match(s,/result\.payable!==false/);
 assert.match(s,/result\.faceVerified!==false/);
 assert.match(s,/ยังไม่ใช่รายการจ่ายเงินเดือน/);
 assert.doesNotMatch(s,/api\/payroll\/approve|api\/payroll\/pay/);
});
