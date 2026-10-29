import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
const U='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const COMPANY='33333333-3333-4333-8333-333333333333';
const base='https://oilstation.goldensoft.cloud';
const data={stationId:STATION,name:'ABC Transport Ltd',taxId:'1234567890123',contactEmail:'admin@example.com',paymentTermsDays:30,dueMode:'statement',statementCloseDay:15};
function setup(role='station_owner'){
 const calls=[];
 const handler=createApi({
  authenticate:async token=>token==='valid'?{id:U}:null,
  db:{memberships:async()=>[{active:true,scope_type:'station',station_id:STATION,role_code:role,extra_permissions:{}}],
   createCorporateCustomer:async args=>{calls.push(args);return {companyId:COMPANY,accountId:U}},
   requestCorporateLink:async args=>{calls.push(args);return {requestId:COMPANY,status:'pending'}},
   approveCorporateLink:async args=>{calls.push(args);return {status:'approved',accountId:U}},
  },
 });
 const req=(path,body)=>new Request(base+path,{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)});
 return {handler,req,calls};
}
test('owner creates zero-balance corporate customer in own station',async()=>{
 const a=setup();
 const response=await a.handler(a.req('/api/station/customers',data));
 assert.equal(response.status,201);
 assert.equal(a.calls.length,1);
 assert.equal(a.calls[0].actorId,U);
 assert.equal(a.calls[0].stationId,STATION);
});
test('operator cannot create companies, other station not accessible',async()=>{
 const a=setup('attendant');
 assert.equal((await a.handler(a.req('/api/station/customers',data))).status,403);
 const b=setup();
 assert.equal((await b.handler(b.req('/api/station/customers',{...data,stationId:COMPANY}))).status,403);
 assert.equal(a.calls.length+b.calls.length,0);
});
test('terms and tax ID are constrained',async()=>{
 const a=setup();
 assert.equal((await a.handler(a.req('/api/station/customers',{...data,paymentTermsDays:-1}))).status,400);
 assert.equal((await a.handler(a.req('/api/station/customers',{...data,taxId:'1234'}))).status,400);
 assert.equal((await a.handler(a.req('/api/station/customers',{...data,dueMode:'statement',statementCloseDay:0}))).status,400);
 assert.equal(a.calls.length,0);
});
test('link existing company is request, not immediate account attachment',async()=>{
 const a=setup();
 const response=await a.handler(a.req('/api/station/link-company',{stationId:STATION,companyId:COMPANY}));
 assert.equal(response.status,201);
 assert.equal(a.calls[0].companyId,COMPANY);
});
