import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const BASE='https://oilstation.goldensoft.cloud';
const request=path=>new Request(BASE+path);
const assets={fetch:async()=>new Response('<html>preview shell</html>',{status:200,headers:{'content-type':'text/html'}})};
test('liveness remains separate; unconfigured release blocks backend and startup config',async()=>{
 const env={ASSETS:assets};
 const alive=await worker.fetch(request('/api/health'),env);
 assert.equal(alive.status,200);
 assert.deepEqual(await alive.json(),{service:'oilstation',status:'ok'});
 const ready=await worker.fetch(request('/api/ready'),env);
 assert.equal(ready.status,503);
 assert.deepEqual(await ready.json(),{service:'oilstation',ready:false});
 for(const path of ['/api/public-config','/api/me','/api/coupons','/api/billing/payment-intent','/api/webhooks/stripe']) {
  const result=await worker.fetch(request(path),env);
  assert.equal(result.status,503,path);
  assert.equal((await result.json()).error,'release_not_enabled');
 }
 assert.equal((await worker.fetch(request('/'),env)).status,200);
});
test('cron is inert until explicit release activation',()=>{
 let calls=0;
 worker.scheduled({}, {ASSETS:assets}, {waitUntil(){calls++}});
 assert.equal(calls,0);
});
test('enabled but missing required secrets still fails release readiness',async()=>{
 const ready=await worker.fetch(request('/api/ready'),{ASSETS:assets,OILSTATION_API_ENABLED:'true'});
 assert.equal(ready.status,503);
 assert.equal((await ready.json()).ready,false);
 const r=await worker.fetch(request('/api/me'),{ASSETS:assets,OILSTATION_API_ENABLED:'true'});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'service_not_configured');
});
test('readiness requires exact SQL migration marker and real backend RPC answer',async()=>{
 const original=globalThis.fetch;
 const requested=[];
 globalThis.fetch=async (url,init)=>{
  requested.push(String(url));
  assert.equal(init.method,'POST');
  return new Response(JSON.stringify({ready:true,schemaVersion:'20261029215000'}),{
   headers:{'content-type':'application/json'},status:200,
  });
 };
 const env={
  ASSETS:assets,OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:'public_test_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_private_key_not_real',
  COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 try{
  const yes=await worker.fetch(request('/api/ready'),env);
  assert.equal(yes.status,200);
  assert.deepEqual(await yes.json(),{service:'oilstation',ready:true});
  assert.deepEqual(requested,['https://test-project.supabase.co/rest/v1/rpc/oilstation_release_status']);
 }finally{globalThis.fetch=original;}
});
