import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/worker.mjs';

test('scheduled coupon expiry invokes server-only RPC without public browser endpoint',async()=>{
 const env={
  OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
  SUPABASE_ANON_KEY:'test-anon',
  SUPABASE_SERVICE_ROLE_KEY:'test-server-only',
  COUPON_SIGNING_KEY:'this-is-a-test-key-with-at-least-thirty-two-characters',
 };
 let pending=null, invoked=0, readiness=0;
 const old=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  invoked++;
  assert.equal(opts.method,'POST');
  assert.equal(opts.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
  if (url===env.SUPABASE_URL+'/rest/v1/rpc/oilstation_release_status') {
    readiness++;
    return new Response(JSON.stringify({ready:true,schemaVersion:'20261029215000'}),{status:200});
  }
  assert.equal(url,env.SUPABASE_URL+'/rest/v1/rpc/expire_reserved_coupons');
  assert.equal(JSON.parse(opts.body).p_limit,200);
  return new Response(JSON.stringify({expired:0,releasedSatang:'0'}),{status:200});
 };
 try{
  worker.scheduled({cron:'*/2 * * * *'},env,{waitUntil:p=>{pending=p;}});
  assert.ok(pending);
  await pending;
  assert.equal(invoked,2);
  assert.equal(readiness,1);
 }finally{globalThis.fetch=old;}
});

test('cron never expires coupons when the database release marker is missing',async()=>{
 const env={
  OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:'test-anon',
  SUPABASE_SERVICE_ROLE_KEY:'test-server-only',
  COUPON_SIGNING_KEY:'this-is-a-test-key-with-at-least-thirty-two-characters',
 };
 const calls=[];
 const old=globalThis.fetch;
 globalThis.fetch=async url=>{
  calls.push(String(url));
  return new Response(JSON.stringify({ready:false,schemaVersion:'20261029215000'}),{status:200});
 };
 try {
  let pending=null;
  worker.scheduled({},env,{waitUntil:p=>{pending=p;}});
  assert.ok(pending);
  await pending;
  assert.deepEqual(calls,[env.SUPABASE_URL+'/rest/v1/rpc/oilstation_release_status']);
 }finally{globalThis.fetch=old;}
});
