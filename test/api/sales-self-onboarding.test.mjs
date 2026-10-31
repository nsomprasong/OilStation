import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApi} from '../../src/api/router.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const requestId='22222222-2222-4222-8222-222222222222';
const base='https://oilstation.goldensoft.cloud';
const station={organizationName:'QA Example Owner',stationName:'QA Sale 01',
 brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false},requestId};
const req=(path,method='GET',body,auth=true)=>new Request(base+path,{method,
 headers:{...(auth?{authorization:'Bearer ok'}:{}),
   ...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})});
const make=(role='platform_sales',isQa=true)=> {
 const calls=[];
 const db={
  memberships:async()=>[{user_id:actor,active:true,scope_type:'platform',role_code:role}],
  salesStations:async id=>{calls.push(['list',id]);return[]},
  salesCreateStation:async d=>{calls.push(['create',d]);return {id:requestId,salesUserId:actor,replayed:false,fuelProductsStaged:3}},
  platformStations:async id=>{calls.push(['adminList',id]);return[]},
  createStation:async d=>{calls.push(['adminCreate',d]);return{id:requestId}},
  fuelBrands:async()=>[{code:'PTT',name_th:'PTT'}],
 };
 return {calls,handle:createApi({authenticate:async token=>token==='ok'?{id:actor,isQa}:null,db})};
};
test('Sales can create their own station and list only their own stations',async()=>{
 const {handle,calls}=make();
 const res=await handle(req('/api/platform/sales/create-station','POST',station));
 assert.equal(res.status,201);
 assert.equal((await res.json()).station.salesUserId,actor);
 assert.deepEqual(calls[0],['create',{actorId:actor,requestId,
  organizationName:station.organizationName,stationName:station.stationName,
  brandCode:'PTT',qrCoupon:true,hrPayroll:false,maxStations:2}]);
 assert.equal((await handle(req('/api/platform/sales/stations'))).status,200);
 assert.deepEqual(calls[1],['list',actor]);
});
test('Sales cannot call Super Admin station creation; non-sales cannot call self-create',async()=>{
 const s=make();
 assert.equal((await s.handle(req('/api/platform/create-station','POST',station))).status,403);
 assert.equal((await s.handle(req('/api/platform/stations'))).status,403);
 const admin=make('platform_superadmin');
 assert.equal((await admin.handle(req('/api/platform/sales/create-station','POST',station))).status,403);
 const attendant=make('attendant');
 assert.equal((await attendant.handle(req('/api/platform/sales/stations'))).status,403);
 assert.equal(s.calls.length+admin.calls.length+attendant.calls.length,0);
});
test('Sales endpoint validates requestId and refuses injected owner/commission IDs',async()=>{
 const s=make();
 for(const bad of [
  {...station,requestId:null},{...station,requestId:'invalid'},
  {...station,salesUserId:actor},{...station,assignedBy:actor},
  {...station,modules:{qrCoupon:true,hrPayroll:false,owner:true}},
  {...station,modules:{qrCoupon:false,hrPayroll:false}},
  {...station,stationName:'A'},
  {...station,brandCode:'invalid'},
 ]){
  const v=await s.handle(req('/api/platform/sales/create-station','POST',bad));
  assert.equal(v.status,400,JSON.stringify(bad));
 }
 assert.equal((await s.handle(req('/api/platform/sales/create-station','POST',station,false))).status,401);
 assert.equal((await s.handle(req('/api/platform/sales/create-station','GET'))).status,405);
 assert.equal(s.calls.length,0);
});
test('normal non-QA Sales are not limited by the synthetic QA fixture rule',async()=>{
 const s=make('platform_sales',false);
 assert.equal((await s.handle(req('/api/platform/sales/create-station','POST',station))).status,201);
 assert.equal(s.calls[0][1].maxStations,null);
});
test('replayed station creation returns 200, not duplicate created state',async()=>{
 const s=make();
 const dbFactory=createApi({
  authenticate:async()=>({id:actor,isQa:true}),
  db:{memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}],
    salesCreateStation:async()=>({id:requestId,replayed:true})},
 });
 const response=await dbFactory(req('/api/platform/sales/create-station','POST',station));
 assert.equal(response.status,200);assert.equal((await response.json()).station.replayed,true);
 assert.equal(s.calls.length,0);
});
test('SQL transaction owns station, assignment, audit, and immutable request key',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261031143000_sales_station_self_onboarding.sql',import.meta.url),'utf8');
 for(const token of ['platform_sales_create_station','platform_sales_station_overview',
   'sales_station_creation_requests','pg_advisory_xact_lock',
   'sales_assignments','v_now','sales_station_created','audit_events',
   'replayed','SALES_STATION_LIMIT_REACHED','FORBIDDEN','raw_app_meta_data',
   'ENABLE ROW LEVEL SECURITY','REVOKE ALL ON FUNCTION',
   'TO service_role'])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/UPDATE\s+public\.commission_entitlements|INSERT\s+INTO\s+public\.commission_ledger/i);
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../../src/client/workspace-layout.js',import.meta.url),'utf8');
 assert.ok(worker.includes("'/api/platform/sales/create-station'"));
 assert.ok(ui.includes("salesMode?'/api/platform/sales/create-station'"));
 assert.ok(ui.includes("creationRequestId ||= crypto.randomUUID()"));
 assert.ok(nav.includes("yes:p||sales"));
});
