import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
test('corporate accounts provide a manual read-only integrity check',()=>{
 assert.match(app,/wallet-check-button/);
 assert.match(app,/api\/corporate\/wallet-integrity\?accountId=/);
 assert.match(app,/x\?\.readOnly!==true/);
 assert.match(app,/x\?\.bankReconciled!==false/);
 assert.match(app,/ยังไม่ใช่การกระทบยอดธนาคาร/);
 assert.match(app,/พบยอดจองคูปองหรือยอดลูกหนี้ไม่ตรงกัน/);
});
