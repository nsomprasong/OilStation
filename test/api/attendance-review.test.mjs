import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttendanceReviewApi} from '../../src/api/attendance-review.mjs';
const U='11111111-1111-4111-8111-111111111111';
const ST='22222222-2222-4222-8222-222222222222';
const EVENT='33333333-3333-4333-8333-333333333333';
const base='https://oilstation.goldensoft.cloud';
function app(denied=false){
 const calls=[];const handler=createAttendanceReviewApi({
 authenticate:async token=>token==='good'?{id:U}:null,
 db:{
  hrAttendancePending:async d=>{calls.push(['list',d]);if(denied)throw {code:'FORBIDDEN'};return []},
  hrReviewAttendance:async d=>{calls.push(['review',d]);if(denied)throw {code:'FORBIDDEN'};
   return {status:d.approved?'accepted':'rejected',faceVerified:false,method:'supervisor_manual'}},
 },
 });return {calls,handler};
}
const req=(data,headers={})=>new Request(base+'/api/hr/attendance/review',{
 method:'POST',headers:{authorization:'Bearer good','content-type':'application/json',...headers},
 body:JSON.stringify(data)});
const valid={eventId:EVENT,approved:true,reason:'ตรวจสอบกะงานจากผู้จัดการปั๊มแล้ว'};
test('manager-only attendance inbox is scoped by station and actor',async()=>{
 const a=app(),r=await a.handler(new Request(base+'/api/hr/attendance/pending?stationId='+ST,{
 headers:{authorization:'Bearer good'}}));
 assert.equal(r.status,200);assert.deepEqual(a.calls,[['list',{actorId:U,stationId:ST}]]);
 const b=app(true);
 assert.equal((await b.handler(new Request(base+'/api/hr/attendance/pending?stationId='+ST,{
 headers:{authorization:'Bearer good'}}))).status,403);
});
test('review requires explicit reason, pending record checked in DB, never face verified',async()=>{
 const a=app(),r=await a.handler(req(valid));
 assert.equal(r.status,200);
 assert.equal((await r.json()).result.faceVerified,false);
 assert.deepEqual(a.calls[0],[ 'review',{actorId:U,...valid} ]);
});
test('self-supplied identity/attendance acceptance, cross-origin, short reasons are blocked',async()=>{
 const a=app();
 for(const d of [{...valid,reason:'ok'},{...valid,actorId:U},{...valid,stationId:ST},
 {...valid,approved:'true'},{...valid,eventId:'bad'}])
  assert.equal((await a.handler(req(d))).status,400);
 assert.equal((await a.handler(req(valid,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await a.handler(req(valid,{authorization:'Bearer invalid'}))).status,401);
 assert.equal(a.calls.length,0);
});
test('unauthorized manager cannot approve',async()=>{
 const b=app(true);assert.equal((await b.handler(req(valid))).status,403);
 assert.deepEqual(b.calls.map(x=>x[0]),['review']);
});
