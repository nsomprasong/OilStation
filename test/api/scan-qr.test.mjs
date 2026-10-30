import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
import { createSupabaseAdapter } from '../../src/adapters/supabase.mjs';

const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const COUPON='33333333-3333-4333-8333-333333333333';
const endpoint='https://oilstation.goldensoft.cloud/api/station/scan-qr';
const signer='the-worker-secret-key-for-qr-256-bits-at-least';
async function qr(){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signer),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const value=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(COUPON+':qr')));
 return COUPON+'.'+[...value].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function make(role='attendant'){
 const calls=[];
 return {calls,handler:createApi({
  authenticate:async t=>t==='good'?{id:USER}:null,
  db:{
   memberships:async()=>[{user_id:USER,scope_type:'station',station_id:STATION,role_code:role,active:true}],
   inspectQr:async (id,payload)=>{calls.push({id,payload});return {couponId:COUPON,stationId:STATION,status:'reserved'};},
  },
 })};
}
const req=(qrPayload,authorization='Bearer good',origin=null)=>{
 const headers={'content-type':'application/json',authorization};
 if(origin)headers.origin=origin;
 return new Request(endpoint,{method:'POST',headers,body:JSON.stringify({qrPayload})});
};
test('station attendant can inspect valid QR without starting fueling',async()=>{
 const a=make();const payload=await qr();
 const r=await a.handler(req(payload));
 assert.equal(r.status,200);
 assert.equal((await r.json()).coupon.status,'reserved');
 assert.deepEqual(a.calls,[{id:USER,payload}]);
});
test('customer or uninvited role cannot scan station QR',async()=>{
 const payload=await qr();const a=make('driver');
 assert.equal((await a.handler(req(payload))).status,403);
 assert.equal(a.calls.length,0);
});
test('malformed, unauthorized and cross-site scan requests are rejected',async()=>{
 const a=make();
 assert.equal((await a.handler(req('not-a-qr'))).status,400);
 assert.equal((await a.handler(req(await qr(),'Bearer bad'))).status,401);
 assert.equal((await a.handler(req(await qr(),'Bearer good','https://evil.invalid'))).status,403);
 assert.equal(a.calls.length,0);
});
test('Supabase adapter rejects tampered signature before any backend call',async()=>{
 const env={SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
   SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',
   COUPON_SIGNING_KEY:signer};
 const a=createSupabaseAdapter(env);
 const payload=await qr();
 const old=globalThis.fetch;let requests=0;
 globalThis.fetch=async(url,init)=>{
   requests++;
   assert.equal(url,env.SUPABASE_URL+'/rest/v1/rpc/inspect_station_coupon');
   assert.equal(JSON.parse(init.body).p_actor_id,USER);
   return new Response(JSON.stringify({couponId:COUPON,status:'reserved'}),{
     status:200,headers:{'content-type':'application/json'},
   });
 };
 try{
   const ok=await a.db.inspectQr(USER,payload);
   assert.equal(ok.status,'reserved');
   const bad=payload.slice(0,-1)+(payload.endsWith('a')?'b':'a');
   await assert.rejects(a.db.inspectQr(USER,bad));
   assert.equal(requests,1);
 }finally{globalThis.fetch=old;}
});
