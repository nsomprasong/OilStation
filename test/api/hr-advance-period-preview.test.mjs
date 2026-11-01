import test from 'node:test';
import assert from 'node:assert/strict';
import {createHrPaymentApi} from '../../src/api/hr-payments.mjs';
const BASE='https://oilstation.goldensoft.cloud';
const ACTOR='11111111-1111-4111-8111-111111111111';
const EMPLOYEE='22222222-2222-4222-8222-222222222222';
const fixture={id:'33333333-3333-4333-8333-333333333333',
 employeeId:EMPLOYEE,status:'approved',amountSatang:10001,
 outstandingSatang:10001,installments:3,firstDeductionDate:'2026-12-15',frequency:'monthly'};
const query='?employeeId='+EMPLOYEE+'&startDate=2026-12-01&endDate=2027-01-01';
const request=(path,token='good')=>new Request(BASE+path,{
 headers:{authorization:'Bearer '+token}});
function handler(db={}){
 return createHrPaymentApi({
  authenticate:async token=>token==='good'?{id:ACTOR}:null,
  db:{hrListAdvances:async()=>[fixture],...db},
 });
}
test('authorized read-only period preview never books wages or pays advances',async()=>{
 let read=0;
 const api=handler({hrListAdvances:async x=>{
  read++;assert.equal(x.actorId,ACTOR);assert.equal(x.employeeId,EMPLOYEE);
  return [fixture];
 }});
 const r=await api(request('/api/hr/advances/period-preview'+query));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(read,1);
 assert.equal(body.proposedSatang,3333);
 assert.equal(body.postedSatang,0);
 assert.equal(body.deductibleSatang,0);
 assert.equal(body.payable,false);
 assert.equal(body.readOnly,true);
 assert.equal(body.items[0].schedule[0].reviewState,'awaiting_disbursement_verification');
});
test('empty employee advances have zero proposals',async()=>{
 const r=await handler({hrListAdvances:async()=>[]})(request('/api/hr/advances/period-preview'+query));
 const body=await r.json();
 assert.equal(body.proposedSatang,0);
 assert.deepEqual(body.items,[]);
});
test('invalid date, invalid employee and unsupported wide range are blocked',async()=>{
 let called=0;
 const api=handler({hrListAdvances:async()=>{called++;return [fixture];}});
 for(const path of [
  '/api/hr/advances/period-preview?employeeId=bad&startDate=2026-12-01&endDate=2027-01-01',
  '/api/hr/advances/period-preview?employeeId='+EMPLOYEE+'&startDate=2026-02-30&endDate=2026-03-01',
  '/api/hr/advances/period-preview?employeeId='+EMPLOYEE+'&startDate=2027-03-01&endDate=2026-03-01',
  '/api/hr/advances/period-preview?employeeId='+EMPLOYEE+'&startDate=2026-01-01&endDate=2028-01-01']){
  const r=await api(request(path));
  assert.equal(r.status,400,path);
 }
 assert.equal(called,3); // Invalid employee rejects before authorized DB lookup
});
test('authorization is delegated to the existing DB owner or station-scoped list RPC',async()=>{
 const api=handler({hrListAdvances:async()=>{const e=new Error('forbidden');e.code='FORBIDDEN';throw e;}});
 const response=await api(request('/api/hr/advances/period-preview'+query));
 assert.equal(response.status,403);
 assert.equal((await response.json()).error,'permission_denied');
 assert.equal((await api(request('/api/hr/advances/period-preview'+query,'bad'))).status,401);
});
