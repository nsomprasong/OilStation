import test from 'node:test';
import assert from 'node:assert/strict';
import {sendInvitedEmailOtp} from '../../src/notifications/invitation-email.mjs';
const env={INVITATION_EMAIL_ENABLED:'true',
 INVITATION_FROM_EMAIL:'invite@goldensoft.cloud',RESEND_API_KEY:'re_'+'x'.repeat(32)};
const email='invited@example.com',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('OTP is sent only to the intended mailbox and is never returned by provider helper',async()=>{
 const calls=[];const r=await sendInvitedEmailOtp({env,email,id,code:'00123456',
  fetchImpl:async(u,o)=>{calls.push([u,o]);return new Response('{"id":"email_test"}',{status:200})}});
 assert.equal(r,true);assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0][1].body).to,[email]);
 assert.equal(calls[0][1].headers['idempotency-key'],'oilstation-invite-otp-'+id);
 assert.ok(JSON.parse(calls[0][1].body).text.includes('00123456'));
});
test('misconfigured provider, invalid codes and failures do not silently pass',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return new Response('{}',{status:200})};
 for(const changes of [{env:{}},{code:'1234567'},{email:'bad@example.com\nbcc:foo'}]){
  assert.equal(await sendInvitedEmailOtp({env,email,id,code:'12345678',fetchImpl,...changes}),false);
 }
 assert.equal(calls,0);
 assert.equal(await sendInvitedEmailOtp({env,email,id,code:'12345678',fetchImpl}),false);
});
