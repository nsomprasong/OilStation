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
 assert.equal((await r.json()).error,'release_not_ready');
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

test('enabled business endpoints refuse stale database release state before any finance RPC',async()=>{
 const original=globalThis.fetch;
 const queries=[];
 const env={
  ASSETS:assets,OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:'public_test_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_private_key_not_real',
  COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 globalThis.fetch=async(url,init)=>{
  queries.push(String(url));
  assert.equal(init.method,'POST');
  return new Response(JSON.stringify({ready:true,schemaVersion:'20261029214000'}),{status:200});
 };
 try{
  for(const path of ['/api/public-config','/api/me','/api/coupons','/api/webhooks/stripe']){
    const response=await worker.fetch(request(path),env);
    assert.equal(response.status,503,path);
    assert.equal((await response.json()).error,'release_not_ready');
  }
  assert.equal(queries.length,4);
  assert.ok(queries.every(q=>q.endsWith('/rpc/oilstation_release_status')));
 }finally{globalThis.fetch=original;}
});

test('verified SQL release allows public configuration but never exposes service key',async()=>{
 const original=globalThis.fetch;
 const env={
  ASSETS:assets,OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:'public_test_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_private_key_not_real',
  COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 globalThis.fetch=async()=>new Response(JSON.stringify({
  ready:true,schemaVersion:'20261029215000',
 }),{status:200});
 try{
  const response=await worker.fetch(request('/api/public-config'),env);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.supabaseUrl,env.SUPABASE_URL);
  assert.equal(data.supabaseAnonKey,env.SUPABASE_ANON_KEY);
  assert.ok(!JSON.stringify(data).includes(env.SUPABASE_SERVICE_ROLE_KEY));
 }finally{globalThis.fetch=original;}
});

test('UAT cannot connect to production database even when someone enables the API',async()=>{
 const original=globalThis.fetch;
 const url='https://cxihsotcpdnalswfoysx.supabase.co';
 let outbound=0;
 globalThis.fetch=async()=>{outbound++;return new Response(JSON.stringify({
  ready:true,schemaVersion:'20261029215000',
 }),{status:200});};
 const base={
  ASSETS:assets,OILSTATION_DEPLOY_TARGET:'uat',OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:url,SUPABASE_ANON_KEY:'public_test_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_private_key_not_real',COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 try{
  for(const changed of [
    {},
    {OILSTATION_UAT_SUPABASE_REF:'cxihsotcpdnalswfoysx'},
    {OILSTATION_UAT_SUPABASE_REF:'abcdefghijklmnopqrst'},
    {SUPABASE_URL:'https://example.supabase.co',OILSTATION_UAT_SUPABASE_REF:'abcdefghijklmnopqrst'},
  ]){
   const env={...base,...changed};
   const ready=await worker.fetch(request('/api/ready'),env);
   assert.equal(ready.status,503);
   assert.deepEqual(await ready.json(),{service:'oilstation',ready:false});
   for(const path of ['/api/public-config','/api/me','/api/invitations/email-challenge']){
    const response=await worker.fetch(request(path),env);
    assert.equal(response.status,503,path);
    assert.equal((await response.json()).error,'release_not_ready');
   }
  }
  assert.equal(outbound,0,'no production or other database RPC permitted');
 }finally{globalThis.fetch=original;}
});

test('UAT readiness requires explicit matching non-production project reference',async()=>{
 const original=globalThis.fetch;
 const requested=[];
 globalThis.fetch=async url=>{
   requested.push(String(url));
   return new Response(JSON.stringify({ready:true,schemaVersion:'20261029215000'}),{status:200});
 };
 const project='abcdefghijklmnopqrst';
 const env={
  ASSETS:assets,OILSTATION_DEPLOY_TARGET:'uat',
  OILSTATION_UAT_SUPABASE_REF:project,OILSTATION_API_ENABLED:'true',
  SUPABASE_URL:'https://'+project+'.supabase.co',
  SUPABASE_ANON_KEY:'public_test_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_private_key_not_real',
  COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 try{
  const ready=await worker.fetch(request('/api/ready'),env);
  assert.equal(ready.status,200);
  assert.deepEqual(requested,['https://'+project+'.supabase.co/rest/v1/rpc/oilstation_release_status']);
 }finally{globalThis.fetch=original;}
});

test('UAT cron cannot touch live SQL even if explicitly enabled',async()=>{
 const original=globalThis.fetch;
 let queries=0;
 globalThis.fetch=async()=>{queries++;throw Error('should be blocked');};
 const env={
  OILSTATION_DEPLOY_TARGET:'uat',OILSTATION_API_ENABLED:'true',
  OILSTATION_UAT_SUPABASE_REF:'cxihsotcpdnalswfoysx',
  SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
 };
 let pending;
 try{
  worker.scheduled({},env,{waitUntil(p){pending=p;}});
  await pending;
  assert.equal(queries,0);
 }finally{globalThis.fetch=original;}
});

test('production preview exposes only public OAuth config, not finance or privileged APIs',async()=>{
 const env={ASSETS:assets,OILSTATION_DEPLOY_TARGET:'production',
  OILSTATION_PREVIEW_LOGIN_ENABLED:'true',OILSTATION_API_ENABLED:'false',
  SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
  SUPABASE_ANON_KEY:'sb_publishable_example_public_only',
  SUPABASE_SERVICE_ROLE_KEY:'not_a_real_private_key'};
 const response=await worker.fetch(request('/api/public-config'),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body,{
  supabaseUrl:env.SUPABASE_URL,supabaseAnonKey:env.SUPABASE_ANON_KEY,
  stripePublishableKey:null,
 });
 assert.ok(!JSON.stringify(body).includes(env.SUPABASE_SERVICE_ROLE_KEY));
 for(const endpoint of ['/api/me','/api/invitations/email-challenge',
     '/api/billing/payment-intent','/api/coupons','/api/webhooks/stripe']){
  const denied=await worker.fetch(request(endpoint),env);
  assert.equal(denied.status,503,endpoint);
  assert.equal((await denied.json()).error,'release_not_enabled');
 }
 const method=await worker.fetch(new Request(BASE+'/api/public-config',{method:'POST'}),env);
 assert.equal(method.status,405);
 assert.equal((await worker.fetch(request('/api/ready'),env)).status,503);
});

test('preview mode permits authenticated first-admin bootstrap and membership lookup only',async()=>{
 const env={
   ASSETS:assets,OILSTATION_DEPLOY_TARGET:'production',
   OILSTATION_PREVIEW_LOGIN_ENABLED:'true',OILSTATION_API_ENABLED:'false',
   SUPABASE_URL:'https://example-test.supabase.co',
   SUPABASE_ANON_KEY:'public_key',SUPABASE_SERVICE_ROLE_KEY:'private_test_key',
   COUPON_SIGNING_KEY:'A'.repeat(48),BOOTSTRAP_ADMIN_EMAIL:'superadmin@example.com',
 };
 const original=globalThis.fetch, urls=[];
 globalThis.fetch=async (url,init)=>{
   const path=String(url);urls.push(path);
   if(path.endsWith('/auth/v1/user')) {
     assert.equal(init.headers.apikey,env.SUPABASE_ANON_KEY);
     return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111'}),{status:200});
   }
   if(path.endsWith('/rpc/bootstrap_first_platform_admin')) {
     const body=JSON.parse(init.body);
     assert.equal(body.p_expected_email,'superadmin@example.com');
     return new Response(JSON.stringify({success:true,role:'platform_superadmin'}),{status:200});
   }
   if(path.includes('/rest/v1/memberships?')) {
     return new Response(JSON.stringify([{active:true,scope_type:'platform',
       role_code:'platform_superadmin',organization_id:null,station_id:null,
       corporate_company_id:null,extra_permissions:{}}]),{status:200});
   }
   throw Error('unexpected external call '+path);
 };
 try{
   const unauthorized=await worker.fetch(new Request(BASE+'/api/bootstrap',{method:'POST'}),env);
   assert.equal(unauthorized.status,401);
   const rejectedOrigin=await worker.fetch(new Request(BASE+'/api/bootstrap',{
     method:'POST',headers:{authorization:'Bearer verified',origin:'https://other.example'},
   }),env);
   assert.equal(rejectedOrigin.status,403);
   assert.equal(urls.length,0);
   const good=await worker.fetch(new Request(BASE+'/api/bootstrap',{
     method:'POST',headers:{authorization:'Bearer verified',origin:BASE},
   }),env);
   assert.equal(good.status,200);
   assert.equal((await good.json()).success,true);
   const me=await worker.fetch(new Request(BASE+'/api/me',{
     headers:{authorization:'Bearer verified'},
   }),env);
   assert.equal(me.status,200);
   assert.equal((await me.json()).memberships[0].role,'platform_superadmin');
   const before=urls.length;
   for(const route of ['/api/invitations/create','/api/coupons','/api/billing/payment-intent']){
     const blocked=await worker.fetch(new Request(BASE+route,{method:'POST'}),env);
     assert.equal(blocked.status,503,route);
   }
   assert.equal(urls.length,before);
 }finally{globalThis.fetch=original;}
});

test('bootstrap preview exemption never applies to isolated UAT or non-preview deployment',async()=>{
 const basic={
  ASSETS:assets,OILSTATION_API_ENABLED:'false',
  SUPABASE_URL:'https://example-test.supabase.co',
  SUPABASE_ANON_KEY:'public_key',SUPABASE_SERVICE_ROLE_KEY:'private_test_key',
  COUPON_SIGNING_KEY:'A'.repeat(48),
 };
 for(const changed of [
   {OILSTATION_DEPLOY_TARGET:'uat',OILSTATION_PREVIEW_LOGIN_ENABLED:'true'},
   {OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'false'},
 ]){
   const r=await worker.fetch(new Request(BASE+'/api/bootstrap',{method:'POST'}),{...basic,...changed});
   assert.equal(r.status,503);
   assert.equal((await r.json()).error,'release_not_enabled');
 }
});
