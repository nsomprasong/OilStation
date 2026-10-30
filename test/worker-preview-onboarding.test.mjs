import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';

const BASE='https://oilstation.goldensoft.cloud';
const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const fuel='33333333-3333-4333-8333-333333333333';
const assets={fetch:async()=>new Response('<html>test</html>')};
const env={
 ASSETS:assets,OILSTATION_DEPLOY_TARGET:'production',
 OILSTATION_API_ENABLED:'false',
 OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',
 SUPABASE_URL:'https://fake-project.supabase.co',
 SUPABASE_ANON_KEY:'public_test_key',
 SUPABASE_SERVICE_ROLE_KEY:'private_test_key',
 COUPON_SIGNING_KEY:'A'.repeat(48),
};
const req=(path,init)=>new Request(BASE+path,init);

test('Superpowers RED: production invitation delivery enabled only for live environment',()=>{
 const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(wrangler.vars.OILSTATION_DEPLOY_TARGET,'production');
 assert.equal(wrangler.vars.INVITATION_EMAIL_ENABLED,'true');
 assert.equal(wrangler.vars.INVITATION_FROM_EMAIL,'no-reply@oilstation.goldensoft.cloud');
 assert.equal(wrangler.env.uat.vars.INVITATION_EMAIL_ENABLED,'false');
});

test('Superpowers RED: station fuel read/write work in a gated pilot without opening financial APIs',async()=>{
 const previous=globalThis.fetch, external=[];
 globalThis.fetch=async (url,init)=>{
  const path=String(url);external.push(path);
  if(path.endsWith('/auth/v1/user')){
   assert.equal(init.headers.apikey,env.SUPABASE_ANON_KEY);
   return new Response(JSON.stringify({id:actor}),{status:200});
  }
  if(path.includes('/rest/v1/memberships?')){
   return new Response(JSON.stringify([{
    user_id:actor,active:true,role_code:'platform_superadmin',
    scope_type:'platform',organization_id:null,station_id:null,
    corporate_company_id:null,extra_permissions:{},
   }]),{status:200});
  }
  if(path.endsWith('/rpc/station_fuel_inventory')){
   assert.deepEqual(JSON.parse(init.body),{p_actor_id:actor,p_station_id:station});
   return new Response(JSON.stringify([{id:fuel,name:'ดีเซล',enabled:false,publicPrice:null}]),{status:200});
  }
  if(path.endsWith('/rpc/configure_station_fuel')){
   const body=JSON.parse(init.body);
   assert.equal(body.p_actor_id,actor);
   assert.equal(body.p_station_id,station);
   assert.equal(body.p_station_fuel_id,fuel);
   assert.equal(body.p_enabled,true);
   return new Response(JSON.stringify({id:fuel,enabled:true,publicPrice:'32.50'}),{status:200});
  }
  throw Error('unexpected outbound call '+path);
 };
 try{
  assert.equal((await worker.fetch(req('/api/station-fuels?stationId='+station),env)).status,401);
  const read=await worker.fetch(req('/api/station-fuels?stationId='+station,{
   headers:{authorization:'Bearer verified'},
  }),env);
  assert.equal(read.status,200);
  assert.equal((await read.json()).fuels[0].enabled,false);
  const update=await worker.fetch(req('/api/station-fuel-config',{
   method:'POST',headers:{authorization:'Bearer verified','content-type':'application/json',origin:BASE},
   body:JSON.stringify({stationId:station,stationFuelId:fuel,enabled:true,publicPrice:'32.50'}),
  }),env);
  assert.equal(update.status,200);
  assert.equal((await update.json()).fuel.publicPrice,'32.50');
  const before=external.length;
  const forged=await worker.fetch(req('/api/station-fuel-config',{
   method:'POST',headers:{authorization:'Bearer verified',origin:'https://other.example',
    'content-type':'application/json'},
   body:JSON.stringify({stationId:station,stationFuelId:fuel,enabled:true,publicPrice:'32.50'}),
  }),env);
  assert.equal(forged.status,403);
  for(const path of ['/api/coupons','/api/billing/payment-intent','/api/topup/review']){
   const r=await worker.fetch(req(path,{method:'POST'}),env);
   assert.equal(r.status,503,path);
  }
  assert.equal(external.length,before);
 }finally{globalThis.fetch=previous;}
});

test('Superpowers RED: UAT must never expose production fuel writes',async()=>{
 const uat={...env,OILSTATION_DEPLOY_TARGET:'uat',
  OILSTATION_API_ENABLED:'false'};
 const res=await worker.fetch(req('/api/station-fuel-config',{
  method:'POST',headers:{authorization:'Bearer verified','content-type':'application/json'},
  body:JSON.stringify({stationId:station,stationFuelId:fuel,enabled:true,publicPrice:'32.50'}),
 }),uat);
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'release_not_enabled');
});
