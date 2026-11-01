import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeaveApi,LEAVE_ROUTES} from '../../src/api/hr-leave.mjs';

const BASE='https://oilstation.goldensoft.cloud',ACTOR='11111111-1111-4111-8111-111111111111';
const EMP='22222222-2222-4222-8222-222222222222',ID='33333333-3333-4333-8333-333333333333';
const call=(path,body,token='good',origin=BASE)=>new Request(BASE+path,{
 method:body?'POST':'GET',headers:{authorization:'Bearer '+token,
  ...(body?{'content-type':'application/json',origin}:{})},
 ...(body?{body:JSON.stringify(body)}:{}),
});
const api=db=>createLeaveApi({authenticate:async token=>token==='good'?{id:ACTOR}:null,db});
const input={employeeId:EMP,leaveType:'annual',startDate:'2026-12-15',
 endDate:'2026-12-16',reason:'QA synthetic only'};
test('leave routes are scoped, keep payroll completely untouched',()=>{
 assert.deepEqual([...LEAVE_ROUTES],[
  '/api/hr/leave','/api/hr/leave/request','/api/hr/leave/review']);
});
test('manager requests leave without wage/attendance mutation',async()=>{
 let written=0;
 const handle=api({hrLeaveRequest:async a=>{
  written++;assert.equal(a.actorId,ACTOR);assert.equal(a.employeeId,EMP);
  assert.equal(a.leaveType,'annual');return {id:ID,status:'pending',payrollImpact:'undetermined'};
 }});
 const res=await handle(call('/api/hr/leave/request',input));
 assert.equal(res.status,201);
 const data=await res.json();
 assert.equal(data.approved,false);assert.equal(data.deducted,false);
 assert.equal(data.payable,false);assert.equal(written,1);
});
test('only reviewed period results are readable via authenticated DB ACL',async()=>{
 const handle=api({hrLeaveList:async a=>{
  assert.deepEqual(a,{actorId:ACTOR,employeeId:EMP});
  return [{id:ID,status:'pending',leaveType:'annual'}];
 }});
 const res=await handle(call('/api/hr/leave?employeeId='+EMP));
 assert.equal(res.status,200);const body=await res.json();
 assert.equal(body.items.length,1);assert.equal(body.payrollImpact,'undetermined');
 assert.equal(body.deducted,false);
 assert.equal((await handle(call('/api/hr/leave?employeeId='+EMP,null,'invalid'))).status,401);
});
test('independent reviewer can approve or reject without posting payroll',async()=>{
 const result={id:ID,status:'approved',replayed:false,deducted:false};
 const h=api({hrLeaveReview:async args=>{
  assert.equal(args.actorId,ACTOR);assert.equal(args.requestId,ID);
  assert.equal(args.approved,true);return result;
 }});
 const response=await h(call('/api/hr/leave/review',{requestId:ID,approved:true}));
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.result.status,'approved');assert.equal(body.payable,false);
 assert.equal(body.deducted,false);
});
test('self approval and foreign-station access denied with no information leak',async()=>{
 for(const error of ['SELF_APPROVAL_FORBIDDEN','FORBIDDEN']){
  const h=api({hrLeaveReview:async()=>{const e=new Error('db');e.code=error;throw e;}});
  const r=await h(call('/api/hr/leave/review',{requestId:ID,approved:true}));
  assert.equal(r.status,403);assert.equal((await r.json()).error,'permission_denied');
 }
});
test('overlapping dates conflict, never grant leave twice',async()=>{
 const h=api({hrLeaveRequest:async()=>{const e=new Error('overlap');e.code='OVERLAPPING_LEAVE';throw e;}});
 const r=await h(call('/api/hr/leave/request',input));
 assert.equal(r.status,409);assert.equal((await r.json()).error,'overlapping_leave');
});
test('invalid dates and types blocked before DB',async()=>{
 let calls=0;
 const h=api({hrLeaveRequest:async()=>{calls++;return{};}});
 for(const bad of [
  {...input,startDate:'2026-02-30'},
  {...input,endDate:'2026-02-01'},
  {...input,startDate:'2026-12-01',endDate:'2027-02-02'},
  {...input,leaveType:'unknown'},
  {...input,reason:'z'.repeat(501)},
  {...input,employeeId:'invalid'},
 ]){
  const r=await h(call('/api/hr/leave/request',bad));assert.equal(r.status,400);
 }
 assert.equal(calls,0);
});
test('origin forgery blocked before DB and invalid review is rejected',async()=>{
 let calls=0;const h=api({hrLeaveRequest:async()=>{calls++;return{};}});
 const x=await h(call('/api/hr/leave/request',input,'good','https://bad.example'));
 assert.equal(x.status,403);
 const y=await h(call('/api/hr/leave/review',{requestId:ID,approved:'yes'}));
 assert.equal(y.status,400);assert.equal(calls,0);
});
test('fail closed when SQL adapter provides no verified list or review',async()=>{
 const h=api({hrLeaveList:async()=>null});
 const r=await h(call('/api/hr/leave?employeeId='+EMP));assert.equal(r.status,503);
});
