import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const EMPLOYEE='33333333-3333-4333-8333-333333333333';
const TEMPLATE='44444444-4444-4444-8444-444444444444';
const BASE='https://oilstation.goldensoft.cloud';
const sample={stationId:STATION,employeeCode:'E-01',name:'Test Staff',wageType:'monthly',wageSatang:'2000000',payrollFrequency:'monthly'};
function make(role='manager'){
 const calls=[];
 const handler=createApi({
  authenticate:async token=>token==='ok'?{id:USER}:null,
  db:{
   memberships:async()=>[{active:true,scope_type:'station',station_id:STATION,role_code:role,extra_permissions:{}}],
   hrRoster:async args=>{calls.push(['roster',args]);return {employees:[],shiftTemplates:[],assignments:[]}},
   hrAddEmployee:async args=>{calls.push(['employee',args]);return {id:EMPLOYEE,name:args.name}},
   hrLinkEmployee:async args=>{calls.push(['employee-link',args]);return {employeeId:args.employeeId,userId:args.userId}},
   hrConfigureGeofence:async args=>{calls.push(['geofence',args]);return {configured:true}},

   hrSeedTemplates:async args=>{calls.push(['seed',args]);return {created:3}},
   hrAssignShift:async args=>{calls.push(['shift',args]);return {id:TEMPLATE}},
  },
 });
 const req=(path,method='GET',data)=>new Request(BASE+path,{method,
 headers:{authorization:'Bearer ok',...(data?{'content-type':'application/json'}:{})},
 ...(data?{body:JSON.stringify(data)}:{})});
 return {handler,req,calls};
}
test('HR manager views only assigned station roster',async()=>{
 const x=make();
 assert.equal((await x.handler(x.req('/api/hr/roster?stationId='+STATION))).status,200);
 assert.equal(x.calls[0][1].stationId,STATION);
 assert.equal((await x.handler(x.req('/api/hr/roster?stationId='+EMPLOYEE))).status,403);
});
test('create employee, seed default shifts and schedule a shift',async()=>{
 const x=make();
 assert.equal((await x.handler(x.req('/api/hr/employees','POST',sample))).status,201);
 assert.equal((await x.handler(x.req('/api/hr/seed-shifts','POST',{stationId:STATION}))).status,200);
 assert.equal((await x.handler(x.req('/api/hr/assign-shift','POST',{stationId:STATION,employeeId:EMPLOYEE,templateId:TEMPLATE,date:'2026-11-02'}))).status,201);
 assert.equal(x.calls.length,3);
});
test('attendant cannot manage payroll roster or shifts',async()=>{
 const x=make('attendant');
 assert.equal((await x.handler(x.req('/api/hr/employees','POST',sample))).status,403);
 assert.equal((await x.handler(x.req('/api/hr/assign-shift','POST',{stationId:STATION,employeeId:EMPLOYEE,templateId:TEMPLATE,date:'2026-11-02'}))).status,403);
 assert.equal(x.calls.length,0);
});
test('invalid wages, shift template and date are rejected',async()=>{
 const x=make();
 assert.equal((await x.handler(x.req('/api/hr/employees','POST',{...sample,wageSatang:'-1'}))).status,400);
 assert.equal((await x.handler(x.req('/api/hr/assign-shift','POST',{stationId:STATION,employeeId:EMPLOYEE,templateId:'wrong',date:'2026-11-02'}))).status,400);
 assert.equal(x.calls.length,0);
});

test('HR owner links existing station user and saves reviewed geofence',async()=>{
 const x=make();
 const userId='55555555-5555-4555-8555-555555555555';
 assert.equal((await x.handler(x.req('/api/hr/employee-link','POST',
   {stationId:STATION,employeeId:EMPLOYEE,userId}))).status,200);
 assert.equal(x.calls[0][0],'employee-link');
 assert.equal(x.calls[0][1].userId,userId);
 const geofence={stationId:STATION,latitude:13.7563,longitude:100.5018,
   radiusMeters:150,maxAccuracyMeters:100};
 assert.equal((await x.handler(x.req('/api/hr/geofence','POST',geofence))).status,200);
 assert.equal(x.calls[1][0],'geofence');
});
test('HR linking and geofence deny foreign scope, bad input and attendant actors',async()=>{
 const userId='55555555-5555-4555-8555-555555555555';
 const geo={stationId:STATION,latitude:13.7563,longitude:100.5018,
  radiusMeters:150,maxAccuracyMeters:100};
 const x=make();
 for(const data of [
  {stationId:STATION,employeeId:'bad',userId},
  {stationId:STATION,employeeId:EMPLOYEE,userId:'bad'},
 ]){
  assert.equal((await x.handler(x.req('/api/hr/employee-link','POST',data))).status,400);
 }
 assert.equal((await x.handler(x.req('/api/hr/geofence','POST',
   {...geo,radiusMeters:1}))).status,400);
 assert.equal((await x.handler(x.req('/api/hr/geofence','POST',
   {...geo,latitude:NaN}))).status,400);
 assert.equal((await x.handler(x.req('/api/hr/geofence','POST',
   {...geo,stationId:EMPLOYEE}))).status,403);
 assert.equal(x.calls.length,0);
 const attendant=make('attendant');
 assert.equal((await attendant.handler(attendant.req('/api/hr/employee-link','POST',
   {stationId:STATION,employeeId:EMPLOYEE,userId}))).status,403);
 assert.equal((await attendant.handler(attendant.req('/api/hr/geofence','POST',geo))).status,403);
 assert.equal(attendant.calls.length,0);
});
