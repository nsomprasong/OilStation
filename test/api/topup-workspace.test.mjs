import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const COMPANY='33333333-3333-4333-8333-333333333333';
const ACCOUNT='44444444-4444-4444-8444-444444444444';
const OTHER='55555555-5555-4555-8555-555555555555';
const BASE='https://oilstation.goldensoft.cloud';
function app(role='corporate_admin',station=STATION){
 const calls=[];
 const handler=createApi({
  authenticate:async token=>token==='valid'?{id:USER}:null,
  db:{
   memberships:async()=>[{user_id:USER,active:true,
     scope_type:role==='corporate_admin'?'corporate_company':'station',
     corporate_company_id:COMPANY,station_id:station,role_code:role,extra_permissions:{}}],
   corporateTopupBanks:async (actor,id)=>{calls.push(['banks',actor,id]);return [{id:OTHER,bankCode:'KBANK',accountNumberMasked:'***1234'}];},
   stationPendingTopups:async (actor,id)=>{calls.push(['queue',actor,id]);return [{requestId:OTHER,amountSatang:'50000',status:'pending'}];},
  },
 });
 const req=path=>new Request(BASE+path,{headers:{authorization:'Bearer valid'}});
 return {handler,req,calls};
}
test('corporate admin sees only bank identifiers and masked bank number',async()=>{
 const x=app();const r=await x.handler(x.req('/api/topup/banks?accountId='+ACCOUNT));
 assert.equal(r.status,200);assert.equal((await r.json()).banks[0].accountNumberMasked,'***1234');
 assert.deepEqual(x.calls,[['banks',USER,ACCOUNT]]);
});
test('station manager views pending top-ups only for own station',async()=>{
 const x=app('manager');
 assert.equal((await x.handler(x.req('/api/topup/pending?stationId='+STATION))).status,200);
 assert.equal((await x.handler(x.req('/api/topup/pending?stationId='+OTHER))).status,403);
 assert.deepEqual(x.calls,[['queue',USER,STATION]]);
});
test('non-finance roles are refused bank details and unassigned queues',async()=>{
 const x=app('attendant');
 assert.equal((await x.handler(x.req('/api/topup/pending?stationId='+STATION))).status,403);
 assert.equal((await x.handler(x.req('/api/topup/banks?accountId='+ACCOUNT))).status,403);
 assert.equal(x.calls.length,0);
});
test('bank and pending top-up read-only routes reject malformed ids and writes',async()=>{
 const x=app();
 assert.equal((await x.handler(x.req('/api/topup/banks?accountId=bad'))).status,400);
 assert.equal((await x.handler(new Request(BASE+'/api/topup/banks',{method:'POST',
  headers:{authorization:'Bearer valid'}}))).status,405);
 assert.equal(x.calls.length,0);
});
