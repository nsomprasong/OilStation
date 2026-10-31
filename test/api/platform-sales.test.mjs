import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformSalesApi} from '../../src/api/platform-sales.mjs';
import {readFileSync} from 'node:fs';
const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const salesperson='33333333-3333-4333-8333-333333333333';
const url='https://oilstation.goldensoft.cloud/api/platform/sales/';
const handler=(db,authenticate=async()=>({id:actor}))=>createPlatformSalesApi({authenticate,db});
const request=(path,data,origin)=>new Request(url+path,{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer good',...(origin?{origin}:{})},
 body:JSON.stringify(data)});
test('sales workspace only reads through authenticated, role-enforced RPC',async()=>{
 const calls=[];
 const api=handler({platformSalesWorkspace:async d=>{calls.push(d);return {people:[],isAdmin:false};}});
 const response=await api(new Request(url+'workspace',{headers:{authorization:'Bearer good'}}));
 assert.equal(response.status,200);
 assert.deepEqual(calls,[{actorId:actor}]);
 assert.equal((await api(new Request(url+'workspace'))).status,401);
 assert.equal((await api(new Request(url+'workspace',{method:'POST'}))).status,405);
 const forbidden=handler({platformSalesWorkspace:async()=>{throw {code:'FORBIDDEN'}}});
 assert.equal((await forbidden(new Request(url+'workspace',{headers:{authorization:'Bearer good'}}))).status,403);
});
test('transfer rejects injection, invalid ids, wrong method and cross-origin requests',async()=>{
 const calls=[];const api=handler({platformSalesTransfer:async d=>{calls.push(d);return {scheduled:true};}});
 for(const bad of [{stationId:'oops',salesUserId:salesperson,reason:'test reason'},
  {stationId:station,salesUserId:salesperson,reason:'x'},
  {stationId:station,salesUserId:salesperson,reason:'valid reason',roleCode:'platform_superadmin'}]){
  assert.equal((await api(request('transfer',bad))).status,400);
 }
 assert.equal((await api(request('transfer',{stationId:station,salesUserId:salesperson,reason:'valid reason'},'https://evil.test'))).status,403);
 assert.equal(calls.length,0);
 const ok=await api(request('transfer',{stationId:station,salesUserId:salesperson,reason:'  move team territory  '}));
 assert.equal(ok.status,200);
 assert.deepEqual(calls[0],{actorId:actor,stationId:station,salesUserId:salesperson,reason:'move team territory'});
});
test('already-scheduled transfer fails closed and cannot silently overwrite history',async()=>{
 const api=handler({platformSalesTransfer:async()=>{throw {code:'TRANSFER_ALREADY_SCHEDULED'}}});
 const res=await api(request('transfer',{stationId:station,salesUserId:salesperson,reason:'change sales territory'}));
 assert.equal(res.status,409);assert.deepEqual(await res.json(),{error:'transfer_already_scheduled'});
});
test('sales SQL is service-role-only, self-scoped, audit logged and never pays commission',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261031120000_platform_sales_workspace.sql',import.meta.url),'utf8');
 for(const piece of ['platform_superadmin','platform_sales','sales_user_id=p_actor_id',
  'TRANSFER_ALREADY_SCHEDULED','FOR UPDATE','audit_events','sales_care_transfer',
  'commission_entitlements','commission_ledger','AT TIME ZONE','effective_until',
  'collectedCustomers',"i.status='paid'"]){
  assert.ok(sql.includes(piece),piece);
 }
 assert.match(sql,/REVOKE ALL ON FUNCTION public.platform_sales_workspace/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.platform_transfer_sales_station/);
 assert.doesNotMatch(sql,/INSERT INTO public\.commission_entitlements|INSERT INTO public\.commission_ledger/);
});
