import test from 'node:test';
import assert from 'node:assert/strict';
import {createStationSaasOnboardingApi} from '../../src/api/station-saas-onboarding.mjs';
const base='https://oilstation.goldensoft.cloud';
const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const plan='33333333-3333-4333-8333-333333333333';
const mock=(error=null)=>{
 const calls=[];
 const handler=createStationSaasOnboardingApi({
  authenticate:async token=>token==='valid'?{id:actor}:null,
  db:{
   stationSaasPlanOptions:async d=>{calls.push(['options',d]);if(error)throw {code:error};return {plans:[]};},
   stationSaasSelectPlan:async d=>{calls.push(['select',d]);if(error)throw {code:error};return {status:'pending_payment'};},
  },
 });
 return {calls,handler};
};
test('only authenticated owner gets plan options and saves selected payment method',async()=>{
 const {calls,handler}=mock();
 const headers={authorization:'Bearer valid'};
 const response=await handler(new Request(base+'/api/station/billing/options?stationId='+station,{headers}));
 assert.equal(response.status,200);
 const selected=await handler(new Request(base+'/api/station/billing/select',{
  method:'POST',headers:{...headers,'content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'promptpay'}),
 }));
 assert.equal(selected.status,200);
 assert.deepEqual(calls.map(c=>c[0]),['options','select']);
 assert.equal(calls[0][1].actorId,actor);
 assert.equal(calls[1][1].actorId,actor);
 assert.deepEqual(calls[1][1],{actorId:actor,stationId:station,planId:plan,paymentMethod:'promptpay'});
});
test('malformed, cross-origin or unauthenticated plan requests do not touch DB',async()=>{
 const {calls,handler}=mock();
 const bad=[
 new Request(base+'/api/station/billing/options?stationId='+station),
 new Request(base+'/api/station/billing/options?stationId=bad',{headers:{authorization:'Bearer valid'}}),
 new Request(base+'/api/station/billing/select',{method:'POST',headers:{
  authorization:'Bearer valid',origin:'https://evil.example','content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'card'})}),
 new Request(base+'/api/station/billing/select',{method:'POST',headers:{
  authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'bank_transfer'})}),
 new Request(base+'/api/station/billing/select',{method:'POST',headers:{
  authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'card',amountSatang:'1'})}),
 ];
 for(const request of bad)assert.notEqual((await handler(request)).status,200);
 assert.equal(calls.length,0);
});
test('DB permission errors never expose private plan data',async()=>{
 const {handler}=mock('FORBIDDEN');
 const r=await handler(new Request(base+'/api/station/billing/options?stationId='+station,{
  headers:{authorization:'Bearer valid'},
 }));
 assert.equal(r.status,403);
 assert.deepEqual(await r.json(),{error:'permission_denied'});
});
