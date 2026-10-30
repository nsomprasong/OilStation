import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const EMPLOYEE='33333333-3333-4333-8333-333333333333';
const SHIFT='44444444-4444-4444-8444-444444444444';
const REQUEST='55555555-5555-4555-8555-555555555555';
const BASE='https://oilstation.goldensoft.cloud';
function app(role='manager'){
 const calls=[];
 const handler=createApi({
  authenticate:async token=>token==='valid'?{id:USER}:null,
  db:{
   memberships:async()=>[{user_id:USER,scope_type:'station',station_id:STATION,role_code:role,active:true}],
   hrRequestOt:async args=>{calls.push(['request',args]);return {requestId:REQUEST,status:'pending'};},
   hrReviewOt:async args=>{calls.push(['review',args]);return {requestId:REQUEST,status:'partial'};},
   hrPendingOt:async args=>{calls.push(['list',args]);return [{id:REQUEST,requestedMinutes:120}];},
  },
 });
 const request=(path,method='GET',body)=>new Request(BASE+path,{method,
   headers:{authorization:'Bearer valid',...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 return {handler,request,calls};
}
const payload={employeeId:EMPLOYEE,shiftId:SHIFT,planned:false,requestedMinutes:120,reason:'cover urgent work'};
test('worker may request OT; manager reviews approved minutes',async()=>{
 const x=app('attendant');
 assert.equal((await x.handler(x.request('/api/hr/request-ot','POST',payload))).status,201);
 assert.equal((await x.handler(x.request('/api/hr/review-ot','POST',{requestId:REQUEST,approvedMinutes:90}))).status,403);
 assert.equal(x.calls.length,1);
 const manager=app();
 assert.equal((await manager.handler(manager.request('/api/hr/review-ot','POST',{requestId:REQUEST,approvedMinutes:90}))).status,200);
 assert.equal((await manager.handler(manager.request('/api/hr/pending-ot?stationId='+STATION))).status,200);
 assert.equal(manager.calls.length,2);
});
test('cannot request negative, excessive or fractional OT minutes',async()=>{
 const a=app();
 for(const n of [-1,0,961,1.5,'120']){
   assert.equal((await a.handler(a.request('/api/hr/request-ot','POST',{...payload,requestedMinutes:n}))).status,400);
 }
 assert.equal(a.calls.length,0);
});
test('cannot submit invalid approval or list without manager membership',async()=>{
 const a=app();
 assert.equal((await a.handler(a.request('/api/hr/review-ot','POST',{requestId:REQUEST,approvedMinutes:-1}))).status,400);
 assert.equal((await a.handler(a.request('/api/hr/review-ot','POST',{requestId:'bad',approvedMinutes:10}))).status,400);
 const b=app('attendant');
 assert.equal((await b.handler(b.request('/api/hr/pending-ot?stationId='+STATION))).status,403);
});
