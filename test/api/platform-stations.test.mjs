import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const U='11111111-1111-4111-8111-111111111111';
const BASE='https://oilstation.goldensoft.cloud';
const req=(path,method='GET',data,authorized=true)=>new Request(BASE+path,{
 method,headers:{...(authorized?{authorization:'Bearer approved'}:{}),...(data?{'content-type':'application/json'}:{})},
 ...(data?{body:JSON.stringify(data)}:{})});
function handler(isAdmin){
 const calls=[];
 return {calls,handle:createApi({
  authenticate:async token=>token==='approved'?{id:U}:null,
  db:{memberships:async()=>[{user_id:U,active:true,scope_type:isAdmin?'platform':'station',
    station_id:'22222222-2222-4222-8222-222222222222',
    role_code:isAdmin?'platform_superadmin':'attendant'}],
    fuelBrands:async()=>[{code:'PTT',name_th:'ปตท.'}],
    platformStations:async id=>{calls.push(['list',id]);return[];},
    createStation:async input=>{calls.push(['create',input]);return{id:'33333333-3333-4333-8333-333333333333',fuelProductsStaged:10};}
  },
 })};
}
const input={organizationName:'ABC Co Ltd',stationName:'Station One',brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false}};
test('only platform superadmin can list and create stations',async()=>{
 const x=handler(true);
 assert.equal((await x.handle(req('/api/platform/stations'))).status,200);
 assert.equal((await x.handle(req('/api/platform/create-station','POST',input))).status,201);
 assert.equal(x.calls.length,2);
 assert.equal(x.calls[1][1].actorId,U);
 const bad=handler(false);
 assert.equal((await bad.handle(req('/api/platform/stations'))).status,403);
 assert.equal((await bad.handle(req('/api/platform/create-station','POST',input))).status,403);
 assert.equal(bad.calls.length,0);
});
test('validate station name, brand and module selection server-side',async()=>{
 const x=handler(true);
 assert.equal((await x.handle(req('/api/platform/create-station','POST',{...input,brandCode:'oops'}))).status,400);
 assert.equal((await x.handle(req('/api/platform/create-station','POST',{...input,stationName:'A'}))).status,400);
 assert.equal((await x.handle(req('/api/platform/create-station','POST',{...input,modules:{qrCoupon:false,hrPayroll:false}}))).status,400);
 assert.equal(x.calls.length,0);
});
test('fuel brand choices require a legitimate membership',async()=>{
 const x=handler(true);const r=await x.handle(req('/api/fuel-brands'));
 assert.equal(r.status,200);assert.equal((await r.json()).brands[0].code,'PTT');
 assert.equal((await x.handle(req('/api/fuel-brands','GET',undefined,false))).status,401);
});
