import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authMarkup} from '../../src/client/auth-screen.js';
const source=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
const guest=source.slice(source.indexOf('function guestView(invited,qaMode=false)'),source.indexOf('async function login(provider)'));
test('login OAuth actions and first-admin link remain visible without an invitation',()=>{
 const html=authMarkup();
 assert.match(html,/id="google"/);
 assert.match(html,/id="facebook"/);
 assert.match(html,/href="\/setup"/);
 assert.match(guest,/document\.getElementById\('google'\)\.addEventListener/);
 assert.match(guest,/document\.getElementById\('facebook'\)\.addEventListener/);
 assert.match(html,/ไม่มีการสมัครสาธารณะ/);
});
test('invited users see welcome invitation rather than setup links',()=>{
 const html=authMarkup({invited:true});
 assert.match(html,/ยืนยันคำเชิญ/);
 assert.doesNotMatch(html,/href="\/setup"/);
});
