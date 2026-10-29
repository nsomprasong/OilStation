import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttendancePayrollPreviewApi} from '../../src/api/attendance-payroll-preview.mjs';
const ACTOR='11111111-1111-4111-8111-111111111111',
 EMPLOYEE='22222222-2222-4222-8222-222222222222',
 BASE='https://oilstation.goldensoft.cloud/api/hr/attendance/payroll-preview';
const from='2026-10-01T00:00:00Z',until='2026-10-02T00:00:00Z';
const url=BASE+'?employeeId='+EMPLOYEE+'&from='+from+'&until='+until;
const reviewed=[{
 id:'33333333-3333-4333-8333-333333333333',eventType:'clock_in',
 occurredAt:'2026-10-01T08:00:59+07:00',reviewStatus:'accepted'},
 {id:'44444444-4444-4444-8444-444444444444',eventType:'clock_out',
 occurredAt:'2026-10-01T09:00:58+07:00',reviewStatus:'accepted'}];
function app(context={status:'preview_only',faceVerified:false,payable:false,events:reviewed}){
 const calls=[];const handle=createAttendancePayrollPreviewApi({
  authenticate:async token=>token==='good'?{id:ACTOR}:null,
  db:{hrReviewedAttendancePunches:async d=>{calls.push(d);return context;}},
 });return {calls,handle};
}
test('manager preview gives conservative rounded time and cannot pay salaries',async()=>{
 const a=app(),r=await a.handle(new Request(url,{headers:{authorization:'Bearer good'}}));
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).workedMinutes,59);
 assert.deepEqual(a.calls,[{actorId:ACTOR,employeeId:EMPLOYEE,from,until}]);
});
test('arbitrary user, date and extra role hints cannot bypass server review',async()=>{
 const a=app();
 assert.equal((await a.handle(new Request(url))).status,401);
 assert.equal((await a.handle(new Request(url.replace(EMPLOYEE,'bad'),{
   headers:{authorization:'Bearer good'}}))).status,400);
 assert.equal((await a.handle(new Request(url.replace(until,'2027-12-30T00:00:00Z'),{
   headers:{authorization:'Bearer good'}}))).status,400);
 assert.equal(a.calls.length,0);
});
test('unreviewed, incomplete or fabricated payable context must fail closed',async()=>{
 for(const context of [
 {status:'preview_only',payable:false,faceVerified:false,events:[reviewed[0]]},
 {status:'preview_only',payable:false,faceVerified:false,
   events:[reviewed[0],{...reviewed[1],reviewStatus:'pending'}]},
 {status:'preview_only',payable:true,faceVerified:false,events:reviewed},
 {status:'preview_only',payable:false,faceVerified:true,events:reviewed},
 ]){
  const a=app(context);
  assert.equal((await a.handle(new Request(url,{headers:{authorization:'Bearer good'}}))).status,409);
 }
});
