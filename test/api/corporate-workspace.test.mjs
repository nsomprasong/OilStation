import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const USER='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const COMPANY='33333333-3333-4333-8333-333333333333';
const OTHER='44444444-4444-4444-8444-444444444444';
const BASE='https://oilstation.goldensoft.cloud';
const req=(path,auth=true)=>new Request(BASE+path,{headers:auth?{authorization:'Bearer good'}:{}});
function make(allowed=true){
 const calls=[];
 const deps={authenticate:async token=>token==='good'?{id:USER}:null,
  db:{
   memberships:async()=>allowed?[{user_id:USER,active:true,scope_type:'corporate_company',corporate_company_id:COMPANY,role_code:'corporate_admin',extra_permissions:{}}]:[],
   corporateAccounts:async id=>{calls.push(['accounts',id]);return [{id:ACCOUNT,stationName:'PTT',availableSatang:'250000',prepaidSatang:'200000',creditLimitSatang:'100000',debtSatang:'30000',reservedSatang:'20000'}];},
   account:async id=>{calls.push(['account',id]);return id===ACCOUNT?{id,company_id:COMPANY,station_id:OTHER}:null;},
   accountFuels:async (actor,account)=>{calls.push(['fuels',actor,account]);return [{id:OTHER,name:'Gasohol 95',publicPrice:'33.50',corporatePrice:'32.50'}];},
  }};
 return {handler:createApi(deps),calls};
}
test('corporate user can list only own accounts with safe string money amounts',async()=>{
 const {handler,calls}=make();
 const res=await handler(req('/api/my-accounts'));
 assert.equal(res.status,200);
 const json=await res.json();
 assert.equal(json.accounts[0].availableSatang,'250000');
 assert.deepEqual(calls,[['accounts',USER]]);
});
test('unknown or not-invited users cannot enumerate accounts',async()=>{
 const a=make();assert.equal((await a.handler(req('/api/my-accounts',false))).status,401);assert.equal(a.calls.length,0);
 const b=make(false);assert.equal((await b.handler(req('/api/my-accounts'))).status,403);assert.equal(b.calls.length,0);
});
test('account-specific fuel selection requires company membership',async()=>{
 const {handler,calls}=make();
 const res=await handler(req('/api/my-accounts/'+ACCOUNT+'/fuels'));
 assert.equal(res.status,200);
 assert.equal((await res.json()).fuels[0].corporatePrice,'32.50');
 assert.deepEqual(calls,[['account',ACCOUNT],['fuels',USER,ACCOUNT]]);
});
test('unowned company account is never queried for fuel products',async()=>{
 const {handler,calls}=make();
 const res=await handler(req('/api/my-accounts/'+OTHER+'/fuels'));
 assert.equal(res.status,404);
 assert.deepEqual(calls,[['account',OTHER]]);
});
test('malformed account paths are rejected',async()=>{
 const {handler,calls}=make();
 assert.equal((await handler(req('/api/my-accounts/not-a-uuid/fuels'))).status,404);
 assert.equal(calls.length,0);
});
