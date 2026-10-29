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
 let pending=null, invoked=0;
 const old=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  invoked++;
  assert.equal(url,env.SUPABASE_URL+'/rest/v1/rpc/expire_reserved_coupons');
  assert.equal(opts.method,'POST');
  assert.equal(JSON.parse(opts.body).p_limit,200);
  assert.equal(opts.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
  return new Response(JSON.stringify({expired:0,releasedSatang:'0'}),{status:200});
 };
 try{
  worker.scheduled({cron:'*/2 * * * *'},env,{waitUntil:p=>{pending=p;}});
  assert.ok(pending);
  await pending;
  assert.equal(invoked,1);
 }finally{globalThis.fetch=old;}
});
