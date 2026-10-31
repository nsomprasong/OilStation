import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformBillingApi} from '../../src/api/platform-billing.mjs';
import {readFileSync} from 'node:fs';

const ACTOR='11111111-1111-4111-8111-111111111111';
const PLAN='22222222-2222-4222-8222-222222222222';
const BASE='https://oilstation.goldensoft.cloud';
const draft={planId:PLAN,code:'standard_2026',name:'Standard รายปี',frequency:'yearly',
 couponPriceSatang:'1600000',hrPriceSatang:'1600000',
 bundlePriceSatang:'2500000',effectiveOn:'2026-11-01'};
function setup(){
 const calls=[];
 const db={
  platformSaasPlanEditor:async args=>{calls.push(['editor',args]);return {planId:PLAN,canEdit:true};},
  platformSaasEditBundlePlan:async args=>{calls.push(['edit',args]);return {planId:PLAN,updated:true};},
 };
 return {calls,handle:createPlatformBillingApi({authenticate:async()=>({id:ACTOR}),db})};
}
const post=(path,body,headers={})=>new Request(BASE+path,{
 method:'POST',headers:{authorization:'Bearer token',origin:BASE,'content-type':'application/json',...headers},
 body:JSON.stringify(body),
});
test('plan editor detail is an authorized scoped GET by UUID',async()=>{
 const {handle,calls}=setup();
 const response=await handle(new Request(BASE+'/api/platform/billing/plan-editor?planId='+PLAN,{
  headers:{authorization:'Bearer token'},
 }));
 assert.equal(response.status,200);
 assert.deepEqual(calls,[['editor',{actorId:ACTOR,planId:PLAN}]]);
 for(const id of ['', 'not-a-uuid']){
  const invalid=await handle(new Request(BASE+'/api/platform/billing/plan-editor?planId='+id,{
   headers:{authorization:'Bearer token'},
  }));
  assert.equal(invalid.status,400);
 }
 assert.equal((await handle(new Request(BASE+'/api/platform/billing/plan-editor?planId='+PLAN))).status,401);
});
test('plan edit accepts exact fields and does not trust submitted actor ID',async()=>{
 const {handle,calls}=setup();
 const response=await handle(post('/api/platform/billing/edit-plan',draft));
 assert.equal(response.status,200);
 assert.deepEqual(calls,[['edit',{actorId:ACTOR,...draft}]]);
 for(const bad of [
  {...draft,actorId:ACTOR},{...draft,planId:'bad'},
  {...draft,code:'BAD SPACE'},{...draft,bundlePriceSatang:'-1'},
  {...draft,effectiveOn:'2026-02-30'}, {...draft,name:'a'},
 ]){
  assert.equal((await handle(post('/api/platform/billing/edit-plan',bad))).status,400);
 }
 assert.equal(calls.length,1);
 assert.equal((await handle(post('/api/platform/billing/edit-plan',draft,{origin:'https://evil.example'}))).status,403);
});
test('in-use or stale plans are blocked without updating financial history',async()=>{
 const handle=createPlatformBillingApi({authenticate:async()=>({id:ACTOR}),
  db:{platformSaasEditBundlePlan:async()=>{throw {code:'PLAN_IN_USE'};}}});
 const response=await handle(post('/api/platform/billing/edit-plan',draft));
 assert.equal(response.status,409);
 assert.deepEqual(await response.json(),{error:'plan_in_use'});
});
test('plan editor SQL requires platform role, locked row and immutable used plans',()=>{
 const fs=requireSql();
 for(const t of ['platform_edit_saas_bundle_plan','FOR UPDATE','platform_superadmin',
  'station_subscriptions','station_plan_checkout_requests','p_plan_id',
  'SET search_path=\'\'','price_satang']){
  assert.ok(fs.includes(t),t);
 }
 assert.match(fs,/REVOKE ALL ON FUNCTION public\.platform_edit_saas_bundle_plan/);
 assert.match(fs,/GRANT EXECUTE ON FUNCTION public\.platform_edit_saas_bundle_plan[\s\S]*?TO service_role/);
});
function requireSql(){return readFileSync(new URL('../../supabase/migrations/20261031100000_platform_plan_editor.sql',import.meta.url),'utf8');}
