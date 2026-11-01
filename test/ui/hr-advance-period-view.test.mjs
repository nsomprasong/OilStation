import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../src/client/hr-payments.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../../src/api/hr-payments.mjs',import.meta.url),'utf8');
const qa=readFileSync(new URL('../../src/api/qa-hr-uat.mjs',import.meta.url),'utf8');

test('approved advance retains short expand-to-see installment breakdown after approval',()=>{
 assert.match(src,/ดูตารางหักรายงวด/);
 assert.match(src,/วางแผนเท่านั้น/);
 assert.match(src,/ยังไม่ยืนยันการจ่ายเงินเบิก/);
 assert.match(src,/planAdvanceInstallments/);
});
test('scoped period preview never exposes salary deductions or pays employees',()=>{
 assert.match(api,/\/api\/hr\/advances\/period-preview/);
 assert.match(api,/postedSatang:0,deductibleSatang:0/);
 assert.match(api,/payable:false,readOnly:true/);
 assert.match(qa,/\/api\/hr\/advances\/period-preview/);
 assert.doesNotMatch(api,/hrPostPayroll|hrPayEmployee|hrTransferMoney|payroll_payouts/);
});
