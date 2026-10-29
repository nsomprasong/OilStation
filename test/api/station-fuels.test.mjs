import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
const U='11111111-1111-4111-8111-111111111111';
const S='22222222-2222-4222-8222-222222222222';
const F='33333333-3333-4333-8333-333333333333';
const BASE='https://oilstation.goldensoft.cloud';
function app(role='station_owner') {
 const calls=[];
 const handle=createApi({
  authenticate:async token=>token==='good'?{id:U}:null,
  db:{
   memberships:async()=>[{user_id:U,scope_type:'station',station_id:S,active:true,role_code:role,extra_permissions:{}}],
   stationFuels:async(actor,station)=>{calls.push(['list',actor,station]);return [{id:F,enabled:false,publicPrice:null}];},
   configureFuel:async args=>{calls.push(['configure',args]);return {id:F,enabled:true,publicPrice:'33.50'};},
  },
 });
 const req=(path,method='GET',body)=>new Request(BASE+path,{
  method,headers:{authorization:'Bearer good',...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 return {handle,req,calls};
}
test('station owner can read and set price for own station',async()=>{
 const a=app();
 let res=await a.handle(a.req('/api/station-fuels?stationId='+S));
 assert.equal(res.status,200);assert.equal((await res.json()).fuels[0].enabled,false);
 res=await a.handle(a.req('/api/station-fuel-config','POST',{stationId:S,stationFuelId:F,enabled:true,publicPrice:'33.50'}));
 assert.equal(res.status,200);
 assert.equal(a.calls[1][1].publicPrice,'33.50');
});
test('staff cannot change price; owner cannot change another station',async()=>{
 const staff=app('attendant');
 assert.equal((await staff.handle(staff.req('/api/station-fuel-config','POST',{stationId:S,stationFuelId:F,enabled:true,publicPrice:'33.50'}))).status,403);
 assert.equal(staff.calls.length,0);
 const owner=app();
 assert.equal((await owner.handle(owner.req('/api/station-fuels?stationId=44444444-4444-4444-8444-444444444444'))).status,403);
 assert.equal(owner.calls.length,0);
});
test('reject invalid price and missing identifiers',async()=>{
 const a=app();
 const data={stationId:S,stationFuelId:F,enabled:true,publicPrice:'0'};
 assert.equal((await a.handle(a.req('/api/station-fuel-config','POST',data))).status,400);
 assert.equal((await a.handle(a.req('/api/station-fuel-config','POST',{...data,publicPrice:'35.12345'}))).status,400);
 assert.equal((await a.handle(a.req('/api/station-fuel-config','POST',{...data,publicPrice:'33.50',stationId:'foo'}))).status,400);
 assert.equal(a.calls.length,0);
});
