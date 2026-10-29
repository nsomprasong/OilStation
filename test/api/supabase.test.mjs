import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAdapter } from '../../src/adapters/supabase.mjs';

const URL='https://cxihsotcpdnalswfoysx.supabase.co';
const env={SUPABASE_URL:URL,SUPABASE_ANON_KEY:'public-anon-key',
  SUPABASE_SERVICE_ROLE_KEY:'service-key-only-in-worker',
  COUPON_SIGNING_KEY:'this-test-only-signing-key-32-bytes-minimum-abcdef'};
const UUID='22222222-2222-4222-8222-222222222222';
function response(status, body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}

test('adapter refuses missing secrets, wrong Supabase host and weak coupon signing key',()=>{
  assert.throws(()=>createSupabaseAdapter({ ...env,SUPABASE_SERVICE_ROLE_KEY:'' }),/secrets/);
  assert.throws(()=>createSupabaseAdapter({ ...env, SUPABASE_URL:'https://evil.example' }),/url/);
  assert.throws(()=>createSupabaseAdapter({ ...env,COUPON_SIGNING_KEY:'short' }),/secrets/);
});

test('authenticate validates token with Supabase Auth, not untrusted user headers',async()=>{
  await withFetch(async(url,init)=>{
    assert.equal(url, URL+'/auth/v1/user');
    assert.equal(init.headers.apikey,env.SUPABASE_ANON_KEY);
    assert.equal(init.headers.authorization,'Bearer good-jwt');
    return response(200,{id:'11111111-1111-4111-8111-111111111111'});
  },async()=>{
    const a=createSupabaseAdapter(env);
    assert.deepEqual(await a.authenticate('good-jwt'),{id:'11111111-1111-4111-8111-111111111111'});
  });
  await withFetch(async()=>response(401,{error:'invalid'}),async()=>{
    assert.equal(await createSupabaseAdapter(env).authenticate('bad'),null);
  });
});

test('server queries only scoped columns using service key, never client JWT',async()=>{
  await withFetch(async(url,init)=>{
    assert.ok(url.includes('/rest/v1/memberships?'));
    assert.ok(url.includes('user_id=eq.'));
    assert.equal(init.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(init.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
    return response(200,[]);
  },async()=>assert.deepEqual(await createSupabaseAdapter(env).db.memberships(UUID),[]));
});

test('coupon RPC uses deterministic signed links on idempotent replay',async()=>{
  const calls=[];
  await withFetch(async(url,init)=>{
    calls.push({url,method:init.method,body:JSON.parse(init.body)});
    return response(200,{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'reserved',replayed:false,
      expires_at:'2026-11-01T00:00:00Z',available_satang:'1000'});
  },async()=>{
    const a=createSupabaseAdapter(env);
    const input={actorId:'11111111-1111-4111-8111-111111111111',
      accountId:UUID,stationFuelId:'33333333-3333-4333-8333-333333333333',
      amountSatang:'250000',expiresAt:'2026-11-01T00:00:00Z',idempotencyKey:'invoice-coupon-001',plate:null};
    const one=await a.db.issueCoupon(input);
    const two=await a.db.issueCoupon(input);
    assert.equal(one.shareUrl,two.shareUrl);
    assert.equal(one.qrPayload,two.qrPayload);
    assert.ok(one.shareUrl.startsWith('https://oilstation.goldensoft.cloud/c/'));
    assert.ok(!one.shareUrl.includes(env.COUPON_SIGNING_KEY));
    assert.equal(calls[0].url,URL+'/rest/v1/rpc/issue_reserved_coupon');
    assert.match(calls[0].body.p_secret_hash,/^[a-f0-9]{64}$/);
    assert.equal(calls[0].body.p_amount_satang,'250000');
  }));
});

test('known SQL insufficient-funds error becomes safe error code',async()=>{
  await withFetch(async()=>response(400,{message:'INSUFFICIENT_FUNDS',details:'bank account private'}),
    async()=>await assert.rejects(createSupabaseAdapter(env).db.account(UUID),{code:'INSUFFICIENT_FUNDS'}));
});
