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
   stationSaasQuoteChange:async d=>{calls.push(['quote',d]);if(error)throw {code:error};return {quote:{totalSatang:'10000'}};},
   stationSaasScheduleChange:async d=>{calls.push(['schedule',d]);if(error)throw {code:error};return {status:'pending'};},
   stationSaasCancelChange:async d=>{calls.push(['cancel',d]);if(error)throw {code:error};return {status:'cancelled'};},
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

test('current station selection must reject unsupported replacement effective date without DB writes',async()=>{
 const {calls,handler}=mock();
 for(const extra of [
  {startsAt:'2026-12-01T00:00:00Z'},
  {effectiveOn:'2026-12-01'},
  {newPlanStartsAt:'2026-12-01T00:00:00Z'}
 ]){const response=await handler(new Request(base+'/api/station/billing/select',{
  method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'card',...extra})
 }));assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'invalid_plan_selection'});}
 assert.equal(calls.length,0);
});
test('existing subscription conflict returns 409 and does not impersonate successful plan transition',async()=>{
 const {calls,handler}=mock('INVALID_REQUEST');
 const response=await handler(new Request(base+'/api/station/billing/select',{
  method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify({stationId:station,planId:plan,paymentMethod:'card'})
 }));
 assert.equal(response.status,409);
 assert.deepEqual(await response.json(),{error:'plan_selection_unavailable'});
 assert.equal(calls.length,1);
});

test('owner can schedule at exact UTC renewal and cancel with scoped station id',async()=>{
 const {calls,handler}=mock();
 const input={stationId:station,nextPlanId:plan,paymentMethod:'promptpay',
  effectiveAt:'2026-12-01T00:00:00.000Z',idempotencyKey:'aa11bb22cc33',targetModules:['hr_payroll','qr_coupon']};
 const req=(path,data)=>handler(new Request(base+path,{method:'POST',
  headers:{authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify(data)}));
 const scheduled=await req('/api/station/billing/change/schedule',input);
 assert.equal(scheduled.status,200);
 assert.deepEqual(calls[0],['schedule',{actorId:actor,...input}]);
 const cancelled=await req('/api/station/billing/change/cancel',{stationId:station,changeId:plan});
 assert.equal(cancelled.status,200);
 assert.deepEqual(calls[1],['cancel',{actorId:actor,stationId:station,changeId:plan}]);
});
test('invalid schedule dates, arbitrary amount, unauthorized and wrong-role blocked before DB call',async()=>{
 const {calls,handler}=mock();
 const input={stationId:station,nextPlanId:plan,paymentMethod:'card',
  effectiveAt:'2026-12-01T00:00:00Z',idempotencyKey:'aa11bb22cc33',targetModules:['hr_payroll','qr_coupon']};
 for(const patch of [
  {effectiveAt:'2026-02-30T00:00:00Z'},
  {effectiveAt:'2026-12-01T00:00:00+07:00'},
  {effectiveAt:'not-a-date'}, {idempotencyKey:'a'},
  {amountSatang:'1'}, {nextPlanId:'bad'}, {paymentMethod:'cash'},
  {targetModules:[]},{targetModules:['qr_coupon','hr_payroll']},
  {targetModules:['qr_coupon','qr_coupon']},{targetModules:['invalid']},
 ]){
  const r=await handler(new Request(base+'/api/station/billing/change/schedule',{
   method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},
   body:JSON.stringify({...input,...patch})}));
  assert.equal(r.status,400);
 }
 const bad=await handler(new Request(base+'/api/station/billing/change/schedule',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
 assert.equal(bad.status,401);
 assert.equal(calls.length,0);
});
test('schedule DB permission fails closed; idempotency conflict is 409',async()=>{
 for(const [error,status] of [['FORBIDDEN',403],['IDEMPOTENCY_CONFLICT',409]]){
  const {handler}=mock(error);
  const r=await handler(new Request(base+'/api/station/billing/change/schedule',{
   method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},
   body:JSON.stringify({stationId:station,nextPlanId:plan,paymentMethod:'card',
    effectiveAt:'2026-12-01T00:00:00Z',idempotencyKey:'aa11bb22cc33',targetModules:['hr_payroll','qr_coupon']})}));
  assert.equal(r.status,status);
 }
});

test('owner quote has canonical module list and price is always server-generated',async()=>{
 const {handler,calls}=mock();const data={stationId:station,nextPlanId:plan,
  paymentMethod:'card',targetModules:['hr_payroll','qr_coupon']};
 const send=body=>handler(new Request(base+'/api/station/billing/change/quote',{
  method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},
  body:JSON.stringify(body)}));
 const ok=await send(data);assert.equal(ok.status,200);
 assert.deepEqual(calls[0],['quote',{actorId:actor,...data}]);
 for(const body of [{...data,amountSatang:'1'},{...data,targetModules:[]},
  {...data,targetModules:['qr_coupon','hr_payroll']},{...data,targetModules:['hr_payroll','hr_payroll']}])
  assert.equal((await send(body)).status,400);
 assert.equal(calls.length,1);
});
