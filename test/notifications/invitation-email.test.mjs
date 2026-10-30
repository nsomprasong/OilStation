import test from 'node:test';
import assert from 'node:assert/strict';
import {sendInvitationEmail} from '../../src/notifications/invitation-email.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email='member@example.com';
const inviteUrl='https://oilstation.goldensoft.cloud/invite/'+'A'.repeat(43);
const base={email,id,inviteUrl,expiresAt:'2099-10-29T11:00:00Z'};
const env={INVITATION_EMAIL_ENABLED:'true',
 INVITATION_FROM_EMAIL:'no-reply@oilstation.goldensoft.cloud',RESEND_API_KEY:'re_'+'x'.repeat(32)};
test('disabled sender returns manual fallback without network traffic',async()=>{
 let count=0;const result=await sendInvitationEmail({...base,env:{},
  fetchImpl:async()=>{count++;throw Error('should not call')}});
 assert.deepEqual(result,{delivery:'manual',deliveryStatus:'not_enabled'});
 assert.equal(count,0);
});
test('misconfigured, cross-project, or unverified sender cannot call Resend',async()=>{
 let count=0;const fetchImpl=async()=>{count++};
 for(const from of ['invalid','invite@goldensoft.cloud','no-reply@ea.goldensoft.cloud',
  'no-reply@oilstation.goldensoft.cloud.evil.test']){
  const result=await sendInvitationEmail({...base,
   env:{...env,INVITATION_FROM_EMAIL:from},fetchImpl});
  assert.equal(result.deliveryStatus,'not_configured');
 }
 assert.equal(count,0);
});
test('provider acceptance sends branded Thai email, strict recipient, stable idempotency key',async()=>{
 const calls=[];
 const result=await sendInvitationEmail({...base,env,
  fetchImpl:async(u,options)=>{calls.push([u,options]);return new Response('{"id":"email_1234"}',{status:200})}});
 assert.deepEqual(result,{delivery:'email_accepted',deliveryStatus:'provider_accepted'});
 assert.equal(calls.length,1);assert.equal(calls[0][0],'https://api.resend.com/emails');
 assert.equal(calls[0][1].headers['idempotency-key'],'oilstation-invite-'+id);
 const payload=JSON.parse(calls[0][1].body);
 assert.deepEqual(payload.to,[email]);
 assert.equal(payload.from,'OilStation <no-reply@oilstation.goldensoft.cloud>');
 assert.ok(payload.text.includes(inviteUrl));
 assert.match(payload.html,/<html lang="th">/);
 assert.match(payload.html,/ยืนยันคำเชิญและเข้าสู่ระบบ/);
 assert.match(payload.html,/ระบบบริหารสถานีบริการน้ำมัน/);
 assert.ok(payload.html.includes(inviteUrl));
 assert.ok(!calls[0][1].body.includes(env.RESEND_API_KEY));
 assert.ok(!payload.html.includes('ea.goldensoft.cloud'));
});
test('timeout, provider rejection or missing receipt never claims email delivered',async()=>{
 for(const f of [async()=>new Response('rejected',{status:429}),
  async()=>new Response('{}',{status:200}),
  async()=>{throw Error('network timeout')}]) {
  const result=await sendInvitationEmail({...base,env,fetchImpl:f});
  assert.equal(result.delivery,'manual');
 }
});
test('external invite URL and malformed email never trigger network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++};
 for(const part of [{inviteUrl:'https://evil.example/invite/'+'A'.repeat(43)},
  {email:'bad\nbcc:foo@example.com'},{id:'bad'}]) {
  const r=await sendInvitationEmail({...base,...part,env,fetchImpl});
  assert.equal(r.delivery,'manual');
 }
 assert.equal(calls,0);
});
