import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../../src/api/router.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const token='A'.repeat(43);
const uri='https://oilstation.goldensoft.cloud';
const deps={
 authenticate:async t=>t==='valid'?{id:actor}:null,
 db:{
  beginInvitedEmailOtp:async d=>({providerAccepted:true,actor:d.actorId}),
  confirmInvitedEmailOtp:async d=>({accepted:d.code==='12345678',scope_type:'station',role_code:'attendant'}),
  memberships:async()=>{throw Error('must not read memberships before invitation acceptance')},
 },
};
const call=(route,body,authorization='Bearer valid',origin=uri)=>createApi(deps)(
 new Request(uri+route,{method:'POST',headers:{authorization,'content-type':'application/json',origin},body:JSON.stringify(body)}));
test('OTP initiation and completion work before any existing memberships',async()=>{
 const b=await call('/api/invitations/email-challenge',{token});
 assert.equal(b.status,202);assert.equal((await b.json()).providerAccepted,true);
 const c=await call('/api/invitations/email-confirm',{token,code:'12345678'});
 assert.equal(c.status,200);assert.equal((await c.json()).accepted,true);
});
test('wrong OTP cannot grant membership; strict token and code format',async()=>{
 assert.equal((await call('/api/invitations/email-confirm',{token,code:'99999999'})).status,400);
 assert.equal((await call('/api/invitations/email-confirm',{token,code:'12a45678'})).status,400);
 assert.equal((await call('/api/invitations/email-challenge',{token:'bad'})).status,400);
});
test('foreign origin and unauthenticated requests are rejected before any challenge',async()=>{
 assert.equal((await call('/api/invitations/email-challenge',{token},'Bearer invalid')).status,401);
 assert.equal((await call('/api/invitations/email-challenge',{token},'Bearer valid','https://evil.example')).status,403);
});
