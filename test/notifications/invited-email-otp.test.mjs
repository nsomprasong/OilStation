import test from 'node:test';
import assert from 'node:assert/strict';
import {sendInvitedEmailOtp} from '../../src/notifications/invitation-email.mjs';
const env={INVITATION_EMAIL_ENABLED:'true',
 INVITATION_FROM_EMAIL:'no-reply@oilstation.goldensoft.cloud',RESEND_API_KEY:'re_'+'x'.repeat(32)};
const email='invited@example.com',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('OTP has matching Thai HTML and text, only the invited recipient, no secrets',async()=>{
 const calls=[];const r=await sendInvitedEmailOtp({env,email,id,code:'00123456',
  fetchImpl:async(u,o)=>{calls.push([u,o]);return new Response('{"id":"email_test"}',{status:200})}});
 assert.equal(r,true);assert.equal(calls.length,1);
 const payload=JSON.parse(calls[0][1].body);
 assert.deepEqual(payload.to,[email]);
 assert.equal(payload.from,'OilStation <no-reply@oilstation.goldensoft.cloud>');
 assert.equal(calls[0][1].headers['idempotency-key'],'oilstation-invite-otp-'+id);
 assert.match(payload.text,/00123456/);
 assert.match(payload.html,/00123456/);
 assert.match(payload.html,/<html lang="th">/);
 assert.match(payload.html,/10 นาที/);
 assert.ok(!calls[0][1].body.includes(env.RESEND_API_KEY));
});
test('new OTP challenges use distinct idempotency keys for resends',async()=>{
 const keys=[];
 const fetchImpl=async(_u,o)=>{keys.push(o.headers['idempotency-key']);return new Response('{"id":"email_ok"}',{status:200})};
 const id2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 assert.equal(await sendInvitedEmailOtp({env,email,id,code:'12345678',fetchImpl}),true);
 assert.equal(await sendInvitedEmailOtp({env,email,id:id2,code:'87654321',fetchImpl}),true);
 assert.notEqual(keys[0],keys[1]);
});
test('misconfigured provider, wrong project sender, invalid codes and failures fail closed',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return new Response('{}',{status:200})};
 for(const changes of [
  {env:{}},{env:{...env,INVITATION_FROM_EMAIL:'no-reply@ea.goldensoft.cloud'}},
  {env:{...env,INVITATION_EMAIL_ENABLED:'false'}},
  {code:'1234567'},{email:'bad@example.com\nbcc:foo'}]){
  assert.equal(await sendInvitedEmailOtp({env,email,id,code:'12345678',fetchImpl,...changes}),false);
 }
 assert.equal(calls,0);
 assert.equal(await sendInvitedEmailOtp({env,email,id,code:'12345678',fetchImpl}),false);
});
