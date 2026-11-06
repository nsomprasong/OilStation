import test from 'node:test';
import assert from 'node:assert/strict';
import {createStationSaasOnboardingApi} from '../../src/api/station-saas-onboarding.mjs';
const B='https://oilstation.goldensoft.cloud';
const S='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const P='11111111-1111-4111-8111-111111111111';
const U='22222222-2222-4222-8222-222222222222';
const current={planId:P,planName:'Owner QA Trial',frequency:'monthly',
 status:'trialing',startsAt:'2026-11-01T00:00:00Z',
 periodEnd:'2026-12-01T00:00:00Z'};
test('owner gets read-only existing SaaS period in plan options, never scheduled a replacement',async()=>{
 const calls=[];
 const a=createStationSaasOnboardingApi({authenticate:async()=>({id:U}),
  db:{stationSaasPlanOptions:async d=>{calls.push(d);return {
   stationName:'QA-S01-A',plans:[],selected:null,subscription:current};}}});
 const r=await a(new Request(B+'/api/station/billing/options?stationId='+S,{headers:{
  authorization:'Bearer qa'}}));
 assert.equal(r.status,200);
 const data=(await r.json()).result;assert.deepEqual(data.subscription,current);
 assert.equal(calls.length,1);assert.equal(calls[0].actorId,U);
 assert.equal(calls[0].stationId,S);
});
test('foreign station owner receives 403, without leaking current subscription',async()=>{
 const a=createStationSaasOnboardingApi({authenticate:async()=>({id:U}),
  db:{stationSaasPlanOptions:async()=>{throw {code:'FORBIDDEN'};}}});
 const r=await a(new Request(B+'/api/station/billing/options?stationId='+S,{headers:{
  authorization:'Bearer qa'}}));
 assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:'permission_denied'});
});
