import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const host='https://oilstation.goldensoft.cloud/api/invitations/create';
function app(withMember=true){
 const calls=[];
 return {calls,handler:createApi({
  authenticate:async token=>token==='valid'?{id:actor}:null,
  db:{
    memberships:async()=>withMember?[{scope_type:'station',station_id:station,role_code:'station_owner',active:true}]:[],
    createInvitation:async args=>{calls.push(args);return{email:args.email,delivery:'manual',inviteUrl:'https://oilstation.goldensoft.cloud/invite/token'};}
  },
  now:()=>new Date('2026-10-29T12:00:00.000Z'),
 })};
}
function request(data,token='valid',origin='https://oilstation.goldensoft.cloud'){
 return new Request(host,{method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json'},body:JSON.stringify(data)});
}
const data={email:'Owner@example.com',roleCode:'attendant',scopeType:'station',scopeId:station};
test('issuer identity comes from verified bearer, email normalized and expiry 7 days',async()=>{
 const {handler,calls}=app();
 const r=await handler(request(data));
 assert.equal(r.status,201);
 assert.equal(calls[0].actorId,actor);
 assert.equal(calls[0].email,'owner@example.com');
 assert.equal(calls[0].expiresAt,'2026-11-05T12:00:00.000Z');
});
test('uninvited users cannot mint invitations; cross-origin denied',async()=>{
 const a=app(false);assert.equal((await a.handler(request(data))).status,403);assert.equal(a.calls.length,0);
 const b=app();assert.equal((await b.handler(request(data,'valid','https://evil.invalid'))).status,403);assert.equal(b.calls.length,0);
 assert.equal((await b.handler(request(data,'bad'))).status,401);
});
test('rejects malformed email and scope IDs without invoking service',async()=>{
 const a=app();
 assert.equal((await a.handler(request({...data,email:'bad'}))).status,400);
 assert.equal((await a.handler(request({...data,scopeId:'abc'}))).status,400);
 assert.equal((await a.handler(request({...data,roleCode:'platform_superadmin'}))).status,201);
 // The service-only SQL RPC rejects unauthorized role escalation;
 // API syntax validation is not the permission boundary.
 assert.equal(a.calls.length,1);
});
