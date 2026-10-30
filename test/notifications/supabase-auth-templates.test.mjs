import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const names={
 'invite-user.html':'ConfirmationURL',
 'confirm-signup.html':'ConfirmationURL',
 'magic-link-or-otp.html':'Token',
 'change-email.html':'ConfirmationURL',
 'reset-password.html':'ConfirmationURL',
 'reauthentication.html':'Token',
};
test('all six Supabase Auth templates preserve correct dynamic links or codes',()=>{
 for(const [file,variable] of Object.entries(names)){
  const html=readFileSync(new URL('../../supabase/email-templates/'+file,import.meta.url),'utf8');
  assert.match(html,/<html lang="th">/);
  assert.match(html,/<meta charset="UTF-8">/);
  assert.match(html,/OilStation/);
  assert.ok(html.includes('{{ .'+variable+' }}'),file+' missing Supabase token');
  assert.ok(!html.includes('ea.goldensoft.cloud'),file+' must not use EA identity');
  assert.ok(!/<script\b/i.test(html),file+' cannot contain active JS');
  assert.ok(!/<img\b/i.test(html),file+' should avoid remote pixels');
  assert.ok(!/\s(?:src|href)=["']https?:\/\//i.test(html),file+' cannot link to external content');
 }
});
test('Auth magic-link code and OilStation Worker invitation OTP are never conflated',()=>{
 const html=readFileSync(new URL('../../supabase/email-templates/magic-link-or-otp.html',import.meta.url),'utf8');
 assert.ok(html.includes('{{ .Token }}'));
 assert.ok(html.includes('{{ .ConfirmationURL }}'));
 assert.match(html,/ไม่ใช่รหัสคำเชิญ 8 หลัก/);
});
