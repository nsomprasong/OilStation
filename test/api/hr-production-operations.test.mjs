import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionHrOperationsApi,PRODUCTION_HR_ROUTES} from '../../src/api/hr-production-operations.mjs';

const BASE='https://oilstation.goldensoft.cloud';
const S1='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const S2='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const A='11111111-1111-4111-8111-111111111111';
const E='22222222-2222-4222-8222-222222222222';
const LIVE={OILSTATION_DEPLOY_TARGET:'production',
 OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_HR_OPERATIONS_ENABLED:'true'};
const req=(path,body,extra={})=>new Request(BASE+path,{
 method:body?'POST':'GET',
 headers:{authorization:'Bearer station_actor',
  ...(body?{'content-type':'application/json',origin:BASE}:{}),...extra},
 ...(body?{body:JSON.stringify(body)}:{}),
});
function mock({role='hr_manager',qa=false,station=S1,second=null,module=true,
  extra={}}={}){
 const calls=[];
 const memberships=[{active:true,scope_type:'station',station_id:station,role_code:role},
  ...(second?[{active:true,scope_type:'station',station_id:second,role_code:role}]:[])];
 const db={
  memberships:async()=>{calls.push('memberships');return memberships;},
  hrModuleEntitled:async ({actorId,stationId})=>{assert.equal(actorId,A);
   calls.push('entitlement:'+stationId);return module;},
  hrRoster:async()=>{calls.push('roster');return {employees:[],shiftTemplates:[],assignments:[]};},
  hrLinkSetup:async()=>{calls.push('link');return {};},
  hrSeedTemplates:async()=>{calls.push('seed');return {created:3};},
  hrLeaveRequest:async()=>{calls.push('leave_write');return {id:'33333333-3333-4333-8333-333333333333'};},
  hrPayrollReadinessEvidence:async()=>{calls.push('readiness');return {};},
  ...extra,
 };
 return {calls,handler:createProductionHrOperationsApi({
  env:{...LIVE},authenticate:async token=>{
   calls.push('auth');return token==='station_actor'?{id:A,isQa:qa}:null;},db,
 })};
}
test('live HR path list excludes payroll writes, payees, advances and money',()=>{
 assert.ok(PRODUCTION_HR_ROUTES.includes('/api/hr/roster'));
 assert.ok(PRODUCTION_HR_ROUTES.includes('/api/hr/payroll/readiness'));
 for(const route of ['/api/hr/payroll/drafts/line',
  '/api/hr/payroll/drafts/review','/api/hr/payroll/policies/propose',
  '/api/hr/payroll/policies/review','/api/hr/payees/register',
  '/api/hr/advances/request','/api/coupons'])
  assert.ok(!PRODUCTION_HR_ROUTES.includes(route),route);
});
test('default off, wrong target and full-release flag never activate independent HR path',async()=>{
 const d=mock();const url=req('/api/hr/roster?stationId='+S1);
 for(const changes of [{OILSTATION_HR_OPERATIONS_ENABLED:'false'},
  {OILSTATION_DEPLOY_TARGET:'uat'},
  {OILSTATION_API_ENABLED:'true'},
  {OILSTATION_PREVIEW_LOGIN_ENABLED:'false'},
  {OILSTATION_PREVIEW_OPERATIONS_ENABLED:'false'}]){
  const handler=createProductionHrOperationsApi({
   env:{...LIVE,...changes},authenticate:async()=>{throw Error('called');},
   db:{memberships:async()=>{throw Error('called');}}});
  assert.equal((await handler(url)).status,503);
 }
 assert.equal(d.calls.length,0);
});
test('must authenticate and require a station membership',async()=>{
 const noAuth=mock();
 assert.equal((await noAuth.handler(new Request(BASE+'/api/hr/roster?stationId='+S1))).status,401);
 assert.equal(noAuth.calls.length,0);
 const d=mock();
 assert.equal((await d.handler(req('/api/hr/roster?stationId='+S1,null,
  {authorization:'Bearer invalid'}))).status,401);
 assert.deepEqual(d.calls,['auth']);
});
test('QA actors cannot use real HR even when member of same station',async()=>{
 const d=mock({qa:true});
 const r=await d.handler(req('/api/hr/roster?stationId='+S1));
 assert.equal(r.status,403);
 assert.deepEqual(d.calls,['auth'],'QA must not reach station tables');
});
test('cross-station, invalid explicit station and inactive role denied before HR RPC',async()=>{
 const d=mock();
 assert.equal((await d.handler(req('/api/hr/roster?stationId='+S2))).status,403);
 assert.equal((await d.handler(req('/api/hr/roster?stationId=bogus'))).status,400);
 assert.equal(d.calls.filter(x=>x.startsWith('entitlement:')).length,0);
 const noRole=mock({role:'corporate_admin'});
 assert.equal((await noRole.handler(req('/api/hr/roster?stationId='+S1))).status,403);
 assert.equal(noRole.calls.includes('roster'),false);
});
test('QR-only stations never reach roster, leave or attendance handlers',async()=>{
 const d=mock({module:false});
 assert.equal((await d.handler(req('/api/hr/roster?stationId='+S1))).status,403);
 assert.equal((await d.handler(req('/api/hr/leave/request',{
  employeeId:E,leaveType:'sick',startDate:'2026-11-10',endDate:'2026-11-10'}))).status,403);
 assert.equal(d.calls.includes('roster'),false);
 assert.equal(d.calls.includes('leave_write'),false);
});
test('manager can read live roster under exact membership and HR entitlement',async()=>{
 const d=mock();
 const r=await d.handler(req('/api/hr/roster?stationId='+S1));
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).roster.employees,[]);
 assert.deepEqual(d.calls,['auth','memberships','entitlement:'+S1,
  'auth','memberships','roster']);
});
test('staff may request leave, but never approve leave without manager role',async()=>{
 const d=mock({role:'cashier'});
 const leave={employeeId:E,leaveType:'sick',startDate:'2026-11-10',
  endDate:'2026-11-10',reason:'Reviewed absence'};
 const r=await d.handler(req('/api/hr/leave/request',leave));
 assert.equal(r.status,201);
 const payload=await r.json();
 assert.equal(payload.payable,false);
 assert.equal(payload.deducted,false);
 assert.equal(d.calls.filter(x=>x==='leave_write').length,1);
 const denied=await d.handler(req('/api/hr/leave/review',{
  requestId:'33333333-3333-4333-8333-333333333333',approved:true}));
 assert.equal(denied.status,403);
 assert.equal(d.calls.filter(x=>x==='leave_write').length,1);
});
test('POST cross origin, unsupported media, oversized and foreign station stop before database',async()=>{
 const d=mock();const input={stationId:S1};
 assert.equal((await d.handler(req('/api/hr/seed-shifts',input,{origin:'https://bad.example'}))).status,403);
 assert.equal((await d.handler(req('/api/hr/seed-shifts',input,
  {'content-type':'text/plain'}))).status,415);
 assert.equal((await d.handler(req('/api/hr/seed-shifts',input,
  {'content-length':'20000'}))).status,413);
 assert.equal((await d.handler(req('/api/hr/seed-shifts',{stationId:S2}))).status,403);
 assert.equal(d.calls.some(x=>x==='seed'),false);
});
test('multiple station roles must supply explicit station for employee-scoped requests',async()=>{
 const d=mock({second:S2});
 assert.equal((await d.handler(req('/api/hr/leave/request',{employeeId:E,
  leaveType:'sick',startDate:'2026-11-10',endDate:'2026-11-10'}))).status,403);
 assert.equal(d.calls.includes('leave_write'),false);
 assert.equal((await d.handler(req('/api/hr/roster?stationId='+S2))).status,200);
 assert.ok(d.calls.includes('entitlement:'+S2));
});
test('wrong method and unallowlisted HR payment routes cannot write to SQL',async()=>{
 const d=mock();const method=new Request(BASE+'/api/hr/roster?stationId='+S1,{
  method:'POST',headers:{authorization:'Bearer station_actor',origin:BASE,
   'content-type':'application/json'},body:'{}'});
 assert.equal((await d.handler(method)).status,405);
 assert.equal((await d.handler(req('/api/hr/payroll/drafts/line',{
  employeeId:E}))).status,404);
 assert.equal((await d.handler(req('/api/hr/advances/request',{
  employeeId:E}))).status,404);
 assert.equal(d.calls.length,0);
});
