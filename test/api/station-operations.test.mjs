import test from 'node:test';
import assert from 'node:assert/strict';
import {createStationOperationsApi,STATION_OPERATIONS_ROUTES} from '../../src/api/station-operations.mjs';
import {createSupabaseAdapter} from '../../src/adapters/supabase.mjs';
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const S='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const M='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const root='https://oilstation.goldensoft.cloud';
function factory(overrides={}){
 const calls=[];
 const db={
  stationCustomerOverview:(...v)=>{calls.push(['credits',...v]);return [{accountId:C,availableSatang:'0'}];},
  stationFuelPlateReport:v=>{calls.push(['report',v]);return [{plate:'QA 1001',amountSatang:'2820'}];},
  memberDirectory:v=>{calls.push(['members',v]);return [{membershipId:M,role:'driver',active:true}];},
  memberChange:v=>{calls.push(['change',v]);return {success:true};},
  hrEmployeeChange:v=>{calls.push(['hr-change',v]);return {success:true};},
  ...overrides,
 };
 return {handler:createStationOperationsApi({authenticate:async token=>
    token==='valid'?{id:U}:null,db}),calls};
}
const get=(path,token='valid')=>new Request(root+path,{headers:{authorization:'Bearer '+token}});
const post=(path,body,origin=root)=>new Request(root+path,{method:'POST',
 headers:{authorization:'Bearer valid','content-type':'application/json',origin},
 body:JSON.stringify(body)});
test('scoped routes reject anonymous station financial and HR access',async()=>{
 assert.deepEqual(STATION_OPERATIONS_ROUTES,['/api/station/customer-overview','/api/fuel/report',
  '/api/members/directory','/api/members/change','/api/hr/employee-change']);
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/station/customer-overview?stationId='+S,''))).status,401);
 assert.equal((await handler(get('/api/station/customer-overview?stationId='+S,'bogus'))).status,401);
 assert.equal((await handler(get('/api/unknown'))).status,404);
 assert.deepEqual(calls,[]);
});
test('credit overview and plate report require validated IDs and return only server data',async()=>{
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/station/customer-overview?stationId=x'))).status,400);
 assert.equal((await handler(get('/api/fuel/report?stationId='+S+'&companyId=x'))).status,400);
 assert.equal((await handler(get('/api/fuel/report?stationId='+S+'&plate='+('A'.repeat(41))))).status,400);
 const credits=await handler(get('/api/station/customer-overview?stationId='+S));
 assert.equal(credits.status,200);
 assert.equal((await credits.json()).accounts[0].availableSatang,'0');
 const report=await handler(get('/api/fuel/report?stationId='+S+'&companyId='+C+'&plate=QA%201001'));
 assert.equal(report.status,200);
 assert.equal((await report.json()).rows[0].plate,'QA 1001');
 assert.equal(calls[1][1].companyId,C);
 assert.equal(calls[1][1].plate,'QA 1001');
});
test('directory and soft-deactivation require scope, POST origin and explicit confirmation',async()=>{
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/members/directory?scopeId='+S+'&scopeType=platform'))).status,400);
 assert.equal((await handler(get('/api/members/directory?scopeId='+S+'&scopeType=station'))).status,200);
 assert.equal((await handler(post('/api/members/change',{membershipId:M,action:'deactivate'}))).status,400);
 assert.equal((await handler(post('/api/members/change',{membershipId:M,action:'deactivate',confirm:true},'https://other.example'))).status,403);
 const changed=await handler(post('/api/members/change',{membershipId:M,action:'edit',roleCode:'accountant'}));
 assert.equal(changed.status,200);
 assert.deepEqual(calls.at(-1)[1],{actorId:U,membershipId:M,action:'edit',roleCode:'accountant'});
 const off=await handler(post('/api/members/change',{membershipId:M,action:'deactivate',confirm:true}));
 assert.equal(off.status,200);
 assert.equal(calls.at(-1)[1].roleCode,null);
});

// Test the trusted adapter boundary; no live database or payroll changes.
test('Supabase RPC preserves scoped member and HR failure codes',async()=>{
 const original=globalThis.fetch;
 const adapter=createSupabaseAdapter({
  SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'sb_secret_isolated_unit_test',
  SUPABASE_ANON_KEY:'anonymous_unit_test',COUPON_SIGNING_KEY:'x'.repeat(32),
 });
 try{
  for(const code of ['PROTECTED_ROLE','DRIVER_HAS_ACTIVE_COUPON',
   'FUTURE_SHIFT_EXISTS','INVALID_ROLE','INVALID_ACTION','ALREADY_INACTIVE']){
   globalThis.fetch=async()=>new Response(JSON.stringify({message:code}),{
    status:400,headers:{'content-type':'application/json'},
   });
   await assert.rejects(adapter.hrEmployeeChange({
    actorId:U,stationId:S,employeeId:M,action:'deactivate',name:null,
   }),error=>error.code===code);
  }
 }finally{globalThis.fetch=original;}
});
test('HR employee changes validate confirmation and return meaningful conflicts',async()=>{
 const {handler,calls}=factory();
 assert.equal((await handler(post('/api/hr/employee-change',{
  stationId:S,employeeId:M,action:'deactivate',
 }))).status,400);
 const success=await handler(post('/api/hr/employee-change',{
  stationId:S,employeeId:M,action:'deactivate',confirm:true,
 }));
 assert.equal(success.status,200);
 assert.deepEqual(calls.at(-1)[1],{
  actorId:U,stationId:S,employeeId:M,action:'deactivate',name:null,
 });
 const blocked=code=>{const e=new Error('supabase_request_failed');e.code=code;throw e;};
 const {handler:conflict}=factory({
  memberChange:()=>blocked('DRIVER_HAS_ACTIVE_COUPON'),
  hrEmployeeChange:()=>blocked('FUTURE_SHIFT_EXISTS'),
 });
 assert.equal((await conflict(post('/api/members/change',{
  membershipId:M,action:'deactivate',confirm:true,
 }))).status,409);
 const shifted=await conflict(post('/api/hr/employee-change',{
  stationId:S,employeeId:M,action:'deactivate',confirm:true,
 }));
 assert.equal(shifted.status,409);
 assert.equal((await shifted.json()).error,'future_shift_exists');
 const {handler:inactive}=factory({hrEmployeeChange:()=>blocked('ALREADY_INACTIVE')});
 const again=await inactive(post('/api/hr/employee-change',{
  stationId:S,employeeId:M,action:'deactivate',confirm:true,
 }));
 assert.equal(again.status,409);
 assert.equal((await again.json()).error,'employee_already_inactive');
});
