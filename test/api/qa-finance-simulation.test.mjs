import test from 'node:test';
import assert from 'node:assert/strict';
import {qaFinanceEnabled,createQaTopupSimulationApi} from '../../src/api/qa-topup-simulation.mjs';
import {createQaOperationsApi} from '../../src/api/qa-operations.mjs';

const USER='11111111-1111-4111-8111-111111111111';
const ACCOUNT='99999999-9999-4999-8999-999999999999';
const REQUEST='88888888-8888-4888-8888-888888888888';
const KEY='77777777-7777-4777-8777-777777777777';
const STATIONS=[
 '22222222-2222-4222-8222-222222222221',
 '22222222-2222-4222-8222-222222222222',
 '22222222-2222-4222-8222-222222222223',
 '22222222-2222-4222-8222-222222222224',
];
const COMPANIES=Array.from({length:12},(_,i)=>
 '33333333-3333-4333-8333-'+String(i+1).padStart(12,'0'));
const env={
 OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_FINANCE_SIM_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:STATIONS.join(','),
 OILSTATION_QA_COMPANY_IDS:COMPANIES.join(','),
};
function app({who='corporate',qa=true,dbFailure=null,config=env}={}){
 const calls=[];
 const memberships=who==='corporate'?
   [{active:true,scope_type:'corporate_company',corporate_company_id:COMPANIES[0],
     role_code:'corporate_admin'}]:
   [{active:true,scope_type:'station',station_id:STATIONS[0],role_code:'station_owner'}];
 const db={
  memberships:async()=>memberships,
  qaRequestTopup:async d=>{calls.push(['request',d]);
   if(dbFailure)throw {code:dbFailure};
   return {requestId:REQUEST,status:'pending',simulated:true};
  },
  qaPendingTopups:async d=>{calls.push(['pending',d]);return [];},
  qaReviewTopup:async d=>{calls.push(['review',d]);
   if(dbFailure)throw {code:dbFailure};
   return {requestId:REQUEST,status:d.approved?'approved':'rejected',simulated:true};
  },
 };
 const deps={env:config,authenticate:async()=>({id:USER,isQa:qa}),db};
 return {handle:createQaTopupSimulationApi(deps),calls,db,deps};
}
const origin='https://oilstation.goldensoft.cloud';
function post(path,body,headers={}){
 return new Request(origin+path,{method:'POST',headers:{
  authorization:'Bearer valid-synthetic-session',
  'content-type':'application/json',origin,...headers,
 },body:JSON.stringify(body)});
}
test('QA finance is disabled without explicit independent switch',async()=>{
 const a=app({config:{...env,OILSTATION_QA_FINANCE_SIM_ENABLED:'false'}});
 assert.equal(qaFinanceEnabled(a.deps.env),false);
 assert.equal((await a.handle(post('/api/qa/finance/topup/request',{
  accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY}))).status,404);
 assert.equal(a.calls.length,0);
});
test('synthetic credit request returns pending only, with no direct wallet write',async()=>{
 const a=app();
 const r=await a.handle(post('/api/qa/finance/topup/request',{
  accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY}));
 assert.equal(r.status,201);
 assert.deepEqual((await r.json()).request,
   {requestId:REQUEST,status:'pending',simulated:true});
 assert.deepEqual(a.calls.map(c=>c[0]),['request']);
 assert.equal(a.calls[0][1].qaRunId,env.OILSTATION_QA_RUN_ID);
 assert.deepEqual(a.calls[0][1].allowed.station,STATIONS);
});
test('QA station owner approval and denial use another role and server-side RPC',async()=>{
 const a=app({who:'station'});
 const req=post('/api/qa/finance/topup/review',{requestId:REQUEST,approved:true});
 const r=await a.handle(req);
 assert.equal(r.status,200);
 assert.equal((await r.json()).result.simulated,true);
 assert.deepEqual(a.calls.map(c=>c[0]),['review']);
 assert.equal(a.calls[0][1].approved,true);
 const rejection=await a.handle(post('/api/qa/finance/topup/review',
  {requestId:REQUEST,approved:false}));
 assert.equal(rejection.status,200);
});
test('unauthorized scope, real actor, forged body and cross-origin fail closed',async()=>{
 for(const opt of [{who:'station'},{qa:false}]){
  const a=app(opt);
  const res=await a.handle(post('/api/qa/finance/topup/request',
   {accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY}));
  assert.equal(res.status,403);
  assert.deepEqual(a.calls,[]);
 }
 const a=app();
 const invalid=[
  {accountId:ACCOUNT,amountSatang:'5000001',requestKey:KEY},
  {accountId:ACCOUNT,amountSatang:'99',requestKey:KEY},
  {accountId:ACCOUNT,amountSatang:'100000',requestKey:'bad'},
  {accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY,bankReceived:true}
 ];
 for(const data of invalid)assert.equal(
  (await a.handle(post('/api/qa/finance/topup/request',data))).status,400);
 assert.equal((await a.handle(post('/api/qa/finance/topup/request',
  {accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY},
  {origin:'https://fake.example'}))).status,403);
 assert.deepEqual(a.calls,[]);
});
test('pending request inbox is station-scoped, zero finance writes',async()=>{
 const a=app({who:'station'});
 const url=origin+'/api/qa/finance/topup/pending?stationId='+STATIONS[0];
 const r=await a.handle(new Request(url,{
  headers:{authorization:'Bearer valid-synthetic-session'}}));
 assert.equal(r.status,200);assert.deepEqual((await r.json()).requests,[]);
 assert.deepEqual(a.calls.map(x=>x[0]),['pending']);
 const blocked=await a.handle(new Request(origin+
  '/api/qa/finance/topup/pending?stationId='+STATIONS[1],{
    headers:{authorization:'Bearer valid-synthetic-session'}}));
 assert.equal(blocked.status,403);
});
test('database denial and pending conflicts are not treated as success',async()=>{
 const a=app({who:'station',dbFailure:'FORBIDDEN'});
 assert.equal((await a.handle(post('/api/qa/finance/topup/review',
  {requestId:REQUEST,approved:true}))).status,403);
 const b=app({dbFailure:'PENDING_EXISTS'});
 assert.equal((await b.handle(post('/api/qa/finance/topup/request',
  {accountId:ACCOUNT,amountSatang:'100000',requestKey:KEY}))).status,409);
});
test('QA operations allow scoped read-only corporate accounts when synthetic wallet is off',async()=>{
 const a=app({config:{...env,OILSTATION_QA_FINANCE_SIM_ENABLED:'false'}});
 let reads=0;
 a.db.corporateAccounts=async actorId=>{reads++;assert.equal(actorId,USER);return [{
   id:ACCOUNT,companyId:COMPANIES[0],stationId:STATIONS[0],availableSatang:'0',
 }];};
 a.db.account=async()=>({company_id:COMPANIES[0],station_id:STATIONS[0]});
 a.db.accountFuels=async()=>[];
 const api=createQaOperationsApi(a.deps);
 const get=path=>new Request(origin+path,{headers:{authorization:'Bearer valid-synthetic-session'}});
 const own=await api(get('/api/my-accounts'));
 assert.equal(own.status,200);
 assert.equal((await own.json()).accounts[0].availableSatang,'0');
 assert.equal(reads,1);
 assert.equal((await api(get('/api/my-accounts/'+ACCOUNT+'/fuels'))).status,200);
 assert.equal((await api(post('/api/coupons',{accountId:ACCOUNT}))).status,404);
 assert.equal((await api(post('/api/qa/finance/topup/request',{
   accountId:ACCOUNT,amountSatang:'10000',requestKey:KEY}))).status,404);
});
test('QA operations do not expose normal corporate accounts to unrelated station users',async()=>{
 const a=app({who:'station'});
 const api=createQaOperationsApi(a.deps);
 const req=new Request(origin+'/api/my-accounts',{
  headers:{authorization:'Bearer valid-synthetic-session'}});
 assert.equal((await api(req)).status,403);
 const disabled=createQaOperationsApi({...a.deps,
  env:{...env,OILSTATION_QA_FINANCE_SIM_ENABLED:'false'}});
 assert.equal((await disabled(req)).status,403);
});
