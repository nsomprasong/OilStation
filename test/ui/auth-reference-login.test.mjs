import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authMarkup} from '../../src/client/auth-screen.js';

const css=readFileSync(new URL('../../public/oilstation.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');

test('login-only angled split card keeps OAuth providers, setup and invitation modes',()=>{
  for(const props of [{},{invited:true},{setup:true},{qaMode:true}]){
    const html=authMarkup(props);
    assert.match(html,/class="os-auth-shell"/);
    assert.match(html,/class="os-auth-frame"/);
    assert.match(html,/class="os-auth-hero"/);
    assert.match(html,/class="os-auth-card"/);
    assert.match(html,/id="google"/);
    assert.match(html,/id="facebook"/);
    assert.match(html,/id="notice"/);
    assert.doesNotMatch(html,/สมัครสมาชิก|สร้างบัญชี|sign\s?up|create account/i);
  }
  assert.match(authMarkup({invited:true}),/ยืนยันคำเชิญ/);
  assert.match(authMarkup({setup:true}),/ผู้ดูแลครั้งแรก/);
  assert.match(authMarkup(),/href="\/setup"/);
  assert.doesNotMatch(authMarkup({invited:true}),/href="\/setup"/);
});

test('QA username/password remains accessible only in QA mode with unchanged bindings',()=>{
  const qa=authMarkup({qaMode:true});
  assert.match(qa,/id="qa-login-form"/);
  assert.match(qa,/id="qa-login-alias"/);
  assert.match(qa,/id="qa-login-password"/);
  assert.match(qa,/type="password"/);
  assert.doesNotMatch(authMarkup(),/id="qa-login-form"/);
  assert.match(main,/signInWithPassword/);
  assert.match(main,/signInWithOAuth/);
});

test('auth reference design lives in the single canonical CSS and supports small screens',()=>{
  const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(html,/href="\/oilstation\.css"/);
  assert.match(css,/\.os-auth-frame\{/);
  assert.match(css,/clip-path:polygon\(0 0,73% 0,100% 100%,0 100%\)/);
  assert.match(css,/--auth-cream:#eae7df/);
  assert.match(css,/\.os-auth-shell\{padding:16px/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
