import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
const guest=source.slice(source.indexOf('function guestView(invited) {'),source.indexOf('async function login(provider)'));
test('login buttons and first-admin setup link remain visible without an invitation',()=>{
 assert.match(guest,/id="google"/);
 assert.match(guest,/id="facebook"/);
 assert.match(guest,/href="\/setup"/);
 assert.match(guest,/document\.getElementById\('google'\)\.addEventListener/);
 assert.match(guest,/document\.getElementById\('facebook'\)\.addEventListener/);
 assert.match(guest,/ไม่เปิดรับสมัครสาธารณะ/);
});
