import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPayrollPolicyApi} from '../../src/api/hr-payroll-policy.mjs';
const base='https://oilstation.goldensoft.cloud',ID='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222',POLICY='33333333-3333-4333-8333-333333333333';
const body={stationId:STATION,effectiveFrom:'2026-12-01',monthlyDivisorDays:30,
 normalDayMinutes:480,overtimeRateBps:15000,annualLeaveDays:6,sickLeaveDays:30,
 personalLeaveDays:3,paidAnnual:true,paidSick:true,paidPersonal:true,
 policyBasis:'Test reviewed policy, synthetic only, never statutory default'};
const request=(path,post,auth='good',origin=base)=>new Request(base+path,{
 method:post?'POST':'GET',
 headers:{authorization:'Bearer '+auth,...(post?{origin,'content-type':'application/json'}:{})},
 ...(post?{body:JSON.stringify(post)}:{})});
const api=db=>createPayrollPolicyApi({authenticate:async token=>token==='good'?{id:ID}:null,db});
test('authorized manager proposes policy without approving payroll',async()=>{
 let count=0;const h=api({hrProposePayrollPolicy:async p=>{
  count++;assert.equal(p.actorId,ID);assert.equal(p.stationId,STATION);
  assert.equal(p.overtimeRateBps,15000);return{id:POLICY,status:'pending'};
 }});
 const r=await h(request('/api/hr/payroll/policies/propose',body));
 assert.equal(r.status,201);const data=await r.json();
 assert.equal(data.payable,false);assert.equal(data.payrollAutoApproved,false);
 assert.equal(data.policy.status,'pending');assert.equal(count,1);
});
test('independent reviewer response never approves or pays a salary',async()=>{
 const h=api({hrReviewPayrollPolicy:async p=>{
  assert.equal(p.actorId,ID);assert.equal(p.approved,true);
  return{id:POLICY,status:'approved',payable:false};
 }});
 const r=await h(request('/api/hr/payroll/policies/review',{policyId:POLICY,approved:true}));
 assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.payable,false);assert.equal(data.payrollAutoApproved,false);
});
test('list scoped to station and excludes unauthenticated',async()=>{
 const h=api({hrListPayrollPolicies:async p=>{
  assert.deepEqual(p,{actorId:ID,stationId:STATION});return[];
 }});
 const r=await h(request('/api/hr/payroll/policies?stationId='+STATION));
 assert.equal(r.status,200);assert.deepEqual((await r.json()).items,[]);
 assert.equal((await h(request('/api/hr/payroll/policies?stationId='+STATION,null,'bad'))).status,401);
});
test('invalid rules blocked before DB, with no guessed legal defaults',async()=>{
 let count=0;const h=api({hrProposePayrollPolicy:async()=>{count++;return{};}});
 for(const p of [{...body,overtimeRateBps:8000},{...body,annualLeaveDays:367},
  {...body,paidSick:'yes'},{...body,policyBasis:'short'},
  {...body,monthlyDivisorDays:32},{...body,stationId:'broken'},
  {...body,effectiveFrom:'2026-02-30'}]){
  const r=await h(request('/api/hr/payroll/policies/propose',p));
  assert.equal(r.status,400);
 }
 assert.equal(count,0);
});
test('station forgery, self approval, duplicate policy and bad origin fail closed',async()=>{
 for(const [name,expected] of [['FORBIDDEN',403],['SELF_APPROVAL_FORBIDDEN',403],
  ['PENDING_PAYROLL_POLICY',409],['POLICY_DATE_IN_USE',409]]){
  const h=api({hrProposePayrollPolicy:async()=>{const e=new Error(name);e.code=name;throw e;}});
  assert.equal((await h(request('/api/hr/payroll/policies/propose',body))).status,expected);
 }
 const h=api({});
 const r=await h(request('/api/hr/payroll/policies/propose',body,'good','https://evil.example'));
 assert.equal(r.status,403);
});
test('policy database migration protects row access, review and no payroll writes',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261101223000_hr_payroll_policy_approval.sql',import.meta.url),'utf8');
 const binding=readFileSync(new URL('../../supabase/migrations/20261101224000_hr_payroll_readiness_policy_binding.sql',import.meta.url),'utf8');
 for(const mark of ['FORCE ROW LEVEL SECURITY','SELF_APPROVAL_FORBIDDEN',
  'hr_propose_payroll_policy','hr_review_payroll_policy','requested_by=p_actor_id',
  "status='pending'",'REVOKE ALL ON FUNCTION','TO service_role'])
  assert.ok(sql.includes(mark),mark);
 assert.match(binding,/'policyReviewed',v_policy_id IS NOT NULL/);
 assert.match(binding,/REVOKE ALL ON FUNCTION/);
 for(const script of [sql,binding])
  assert.doesNotMatch(script,/INSERT INTO public\.payroll_(runs|lines|payouts)|UPDATE public\.salary_advances/i);
});
test('policy UI is separate collapsed management item on payroll page',()=>{
 const source=readFileSync(new URL('../../src/client/attendance-payroll-preview.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../../src/client/hr-payroll-policy.js',import.meta.url),'utf8');
 assert.match(source,/mountHrPayrollPolicy/);
 assert.match(source,/details/);
 assert.match(ui,/ต้องให้ผู้มีสิทธิ์อีกบัญชีตรวจ/);
 assert.match(ui,/กำหนดนโยบายตามเอกสารของสถานีเอง/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage/);
});
