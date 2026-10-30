import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseConnectivityProbe} from '../../src/api/supabase-connectivity.mjs';
import worker from '../../src/worker.mjs';
const base='https://oilstation.goldensoft.cloud';
const probe=base+'/api/internal/supabase-connectivity';
const token='T'.repeat(48);
const env={OILSTATION_DIAGNOSTICS_ENABLED:'true',DIAGNOSTICS_BEARER_TOKEN:token,
 SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_testonly',
 SUPABASE_SERVICE_ROLE_KEY:'sb_secret_testonly',OILSTATION_API_ENABLED:'false'};
const request=(path=probe,headers={authorization:'Bearer '+token},method='GET')=>
 new Request(path,{method,headers});
test('diagnostic disabled by default, hidden without a dedicated token',async()=>{
 let calls=0;
 const h=createSupabaseConnectivityProbe({...env,OILSTATION_DIAGNOSTICS_ENABLED:'false'},{
  fetchImpl:async()=>{calls++;return new Response('{}',{status:200})}});
 assert.equal((await h(request())).status,404);
 const h2=createSupabaseConnectivityProbe(env,{fetchImpl:async()=>{calls++;return new Response('{}',{status:200})}});
 assert.equal((await h2(request(probe,{}))).status,401);
 assert.equal((await h2(request(probe,{authorization:'Bearer '+ 'X'.repeat(48)}))).status,401);
 assert.equal((await h2(request(probe,{authorization:'Bearer '+token,origin:base}))).status,403);
 assert.equal((await h2(request(probe,{authorization:'Bearer '+token},'POST'))).status,405);
 assert.equal(calls,0);
});
test('read-only authenticated probe verifies both key classes with zero catalog rows',async()=>{
 const calls=[];
 const h=createSupabaseConnectivityProbe(env,{fetchImpl:async(url,init)=>{
  calls.push({url,init});return new Response('{}',{status:200});
 }});
 const r=await h(request());
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{connected:true,publicKeyValid:true,serviceKeyValid:true});
 assert.deepEqual(calls.map(x=>x.url),[
  'https://example.supabase.co/auth/v1/settings',
  'https://example.supabase.co/rest/v1/brand_fuel_products?select=id&limit=0',
 ]);
 assert.ok(calls.every(x=>x.init.method==='GET'&&x.init.redirect==='error'));
 assert.ok(calls.every(x=>!x.init.body));
 assert.equal(calls[0].init.headers.apikey,env.SUPABASE_ANON_KEY);
 assert.equal(calls[1].init.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
 assert.ok(!JSON.stringify(await h(request())).includes(env.SUPABASE_SERVICE_ROLE_KEY));
});
test('a wrong key or network failure reports no backend access, not false success',async()=>{
 const h=createSupabaseConnectivityProbe(env,{fetchImpl:async(url)=>{
  if(url.includes('/auth/'))return new Response('{}',{status:200});
  return new Response('{}',{status:401});
 }});
 const r=await h(request());
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{connected:false,publicKeyValid:true,serviceKeyValid:false});
 const failing=createSupabaseConnectivityProbe(env,{fetchImpl:async()=>{throw Error('offline')}});
 assert.equal((await failing(request())).status,503);
});
test('missing/malformed Supabase URL cannot generate uncontrolled outbound fetch',async()=>{
 let calls=0;
 const h=createSupabaseConnectivityProbe({...env,SUPABASE_URL:'https://attacker.invalid'},{
  fetchImpl:async()=>{calls++}});
 const r=await h(request());
 assert.equal(r.status,503);
 assert.equal(calls,0);
});
test('Worker API stays release-disabled while optional diagnostic is disabled',async()=>{
 const assets={fetch:async()=>new Response('shell')};
 const r=await worker.fetch(request(),{...env,ASSETS:assets,OILSTATION_DIAGNOSTICS_ENABLED:'false'});
 assert.equal(r.status,404);
 const business=await worker.fetch(request(base+'/api/me'),{...env,ASSETS:assets});
 assert.equal(business.status,503);
 assert.equal((await business.json()).error,'release_not_enabled');
});
