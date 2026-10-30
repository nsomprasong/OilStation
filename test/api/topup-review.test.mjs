import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../../src/api/router.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const REQUEST='22222222-2222-4222-8222-222222222222';
const STATION='33333333-3333-4333-8333-333333333333';
const URL='https://oilstation.goldensoft.cloud/api/topup/review';
function app(role='manager'){
 const calls=[];
 const api=createApi({
  authenticate:async token=>token==='valid'?{id:USER}:null,
  db:{
   memberships:async()=>[{user_id:USER,active:true,
     scope_type:role==='corporate_admin'?'corporate_company':'station',
     station_id:STATION,role_code:role,extra_permissions:{}}],
   reviewTopup:async d=>{calls.push(d);return {requestId:REQUEST,status:d.approved?'approved':'rejected',
     replayed:false,paidDebtSatang:'0',addedPrepaidSatang:d.approved?'25000':'0'};},
  },
 });
 const request=body=>new Request(URL,{method:'POST',headers:{
   authorization:'Bearer valid','content-type':'application/json',
 },body:JSON.stringify(body)});
 return {api,calls,request};
}
test('station manager confirms bank receipt and exact reference for approved top-up',async()=>{
 const a=app();
 const r=await a.api(a.request({
   requestId:REQUEST,approved:true,bankReceived:true,bankReference:'TX-000123',
 }));
 assert.equal(r.status,200);
 assert.equal((await r.json()).result.status,'approved');
 assert.deepEqual(a.calls,[{
  actorId:USER,requestId:REQUEST,approved:true,bankReceived:true,bankReference:'TX-000123',
 }]);
});
test('rejection does not claim received funds or require bank reference',async()=>{
 const a=app();
 const r=await a.api(a.request({requestId:REQUEST,approved:false}));
 assert.equal(r.status,200);
 assert.equal(a.calls[0].bankReceived,false);
 assert.equal(a.calls[0].bankReference,null);
});
test('cannot approve without actual bank receipt confirmation or reference',async()=>{
 const a=app();
 for(const value of [
  {requestId:REQUEST,approved:true,bankReceived:false,bankReference:'TX-000123'},
  {requestId:REQUEST,approved:true,bankReceived:true,bankReference:'short'},
  {requestId:'bad',approved:true,bankReceived:true,bankReference:'TX-000123'},
 ]){
  assert.equal((await a.api(a.request(value))).status,400);
 }
 assert.equal(a.calls.length,0);
});
test('corporate users cannot approve even when they know top-up request ID',async()=>{
 const a=app('corporate_admin');
 assert.equal((await a.api(a.request({
  requestId:REQUEST,approved:true,bankReceived:true,bankReference:'TX-000123',
 }))).status,403);
 assert.equal(a.calls.length,0);
});
