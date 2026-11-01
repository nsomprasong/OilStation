import test from 'node:test';
import assert from 'node:assert/strict';
import {createPayrollReadinessApi} from '../../src/api/hr-payroll-readiness.mjs';
import {readFileSync} from 'node:fs';
const ID='11111111-1111-4111-8111-111111111111',EMP='22222222-2222-4222-8222-222222222222';
const BASE='https://oilstation.goldensoft.cloud';
const params='?employeeId='+EMP+'&startDate=2026-11-01&endDate=2026-12-01';
const request=(query=params,token='pass')=>new Request(BASE+'/api/hr/payroll/readiness'+query,{
 headers:{authorization:'Bearer '+token}});
const proof={employeeId:EMP,stationId:ID,startDate:'2026-11-01',endDate:'2026-12-01',
 employeeStatus:'active',wageType:'monthly',wageSatang:'1900000',payrollFrequency:'monthly',
 pendingLeave:1,approvedLeave:0,approvedUnpaidLeave:0,pendingOt:0,approvedOt:0,
 scheduledShifts:2,attendancePunches:4,unreviewedPunches:0,rejectedPunches:0,
 approvedPrimaryPayees:1,openAdvances:0,policyReviewed:false,statutoryReviewed:false,
 payable:false,readOnly:true,postedSatang:0};
const make=(db={})=>createPayrollReadinessApi({authenticate:async t=>t==='pass'?{id:ID}:null,
 db:{hrPayrollReadinessEvidence:async()=>proof,...db}});
test('strict auth, valid date and scoped read-only evidence',async()=>{
 let called=0;
 const h=make({hrPayrollReadinessEvidence:async x=>{
  called++;assert.deepEqual(x,{actorId:ID,employeeId:EMP,
   startDate:'2026-11-01',endDate:'2026-12-01'});return proof;}});
 const result=await h(request());assert.equal(result.status,200);
 const p=await result.json();assert.ok(p.issueCodes.includes('pending_leave'));
 assert.equal(p.payable,false);assert.equal(p.postedSatang,0);
 assert.equal(Object.hasOwn(p,'wageSatang'),false);
 assert.equal((await h(request(params,'bad'))).status,401);
 assert.equal(called,1);
});
test('invalid requests never reach database',async()=>{
 let count=0;const h=make({hrPayrollReadinessEvidence:async()=>{count++;return proof;}});
 for(const suffix of ['?employeeId=bad&startDate=2026-11-01&endDate=2026-12-01',
  '?employeeId='+EMP+'&startDate=2026-02-30&endDate=2026-03-31',
  '?employeeId='+EMP+'&startDate=2026-11-10&endDate=2026-11-01',
  '?employeeId='+EMP+'&startDate=2026-01-01&endDate=2026-12-01']){
  const r=await h(request(suffix));assert.equal(r.status,400);
 }
 assert.equal(count,0);
});
test('foreign station denied and bad DB evidence fails closed',async()=>{
 for(const err of ['FORBIDDEN','NOT_FOUND']){
  const h=make({hrPayrollReadinessEvidence:async()=>{
   const e=new Error('DB');e.code=err;throw e;
  }});
  const r=await h(request());
  assert.equal(r.status,err==='FORBIDDEN'?403:404);
 }
 const h=make({hrPayrollReadinessEvidence:async()=>({...proof,employeeId:ID})});
 assert.equal((await h(request())).status,503);
});
test('leave and payroll eligibility checks are read-only in migration',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261101220000_hr_payroll_readiness_evidence.sql',import.meta.url),'utf8');
 for(const text of ['SECURITY DEFINER SET search_path','FORBIDDEN','p_actor_id',
  'leave_requests','overtime_requests','attendance_events','salary_advances',
  'employee_payment_methods','REVOKE ALL ON FUNCTION','TO service_role'])
  assert.ok(sql.includes(text),text);
 assert.doesNotMatch(sql,/INSERT INTO public\.(payroll_runs|payroll_lines|payroll_payouts|advance_repayments)/i);
 assert.doesNotMatch(sql,/UPDATE public\.(salary_advances|payroll_runs|payroll_lines|payroll_payouts)/i);
});
test('new readiness route is scoped to HR QA station gate and public release guard',()=>{
 const qa=readFileSync(new URL('../../src/api/qa-hr-uat.mjs',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 assert.match(qa,/OILSTATION_QA_HR_UAT_ENABLED/);
 assert.match(qa,/\/api\/hr\/payroll\/readiness/);
 assert.match(qa,/createPayrollReadinessApi\(deps\)/);
 assert.match(worker,/OILSTATION_API_ENABLED/);
 assert.match(worker,/createPayrollReadinessApi\(deps\)/);
});
