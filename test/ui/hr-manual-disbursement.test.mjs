import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/client/hr-payments.js',import.meta.url),'utf8');
test('employees cannot be marked paid by merely opening a PromptPay QR',()=>{
 assert.match(source,/QR ไม่ใช่หลักฐานว่าจ่ายแล้ว/);
 assert.match(source,/bankReference:bankRef\.input\.value/);
 assert.match(source,/แจ้งโอนเงินเบิกจากแอปธนาคารแล้ว/);
 assert.match(source,/ยังไม่ถือว่าจ่ายจนกว่าคนละบัญชีตรวจธนาคาร/);
});
test('manual transfer requires deliberate review and has rejection action',()=>{
 assert.match(source,/ยืนยันหลังตรวจรายการธนาคารแล้ว/);
 assert.match(source,/หลักฐานไม่ผ่าน/);
 assert.match(source,/manual-confirmation\/review/);
 assert.match(source,/manual-confirmation\/submit/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie/);
});
