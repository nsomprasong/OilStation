import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPayrollDraftApi} from '../../src/api/hr-payroll-draft.mjs';
const B='https://oilstation.goldensoft.cloud';
const actor='11111111-1111-4111-8111-111111111111';
const employee='22222222-2222-4222-8222-222222222222';
const run='33333333-3333-4333-8333-333333333333';
const data={employeeId:employee,startDate:'2026-11-01',endDate:'2026-12-01',
 baseSatang:'2000000',otSatang:'15000',otherEarningsSatang:'0',
 taxSatang:'4000',socialSecuritySatang:'50000',otherDeductionsSatang:'0',
 adjustmentSatang:'0',basis:'Reviewed monthly salary and payroll tax documents, synthetic QA only'};
const req=(path,body,token='good',origin=B)=>new Request(B+path,{method:body?'POST':'GET',
 headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json',origin}:{})},
 ...(body?{body:JSON.stringify(body)}:{})});
const make=db=>createPayrollDraftApi({authenticate:async t=>t==='good'?{id:actor}:null,db});
test('draft line requires reviewed manual monetary inputs and never triggers payment',async()=>{
 const h=make({hrCreatePayrollReviewLine:async input=>{
  assert.equal(input.actorId,actor);assert.equal(input.baseSatang,'2000000');
  assert.equal(input.taxSatang,'4000');return{runId:run,status:'draft',
   grossSatang:'2015000',netSatang:'1961000',payable:false};}});
 const r=await h(req('/api/hr/payroll/drafts/line',data));
 assert.equal(r.status,201);const result=await r.json();
 assert.equal(result.line.status,'draft');assert.equal(result.payable,false);
 assert.equal(result.posted,false);assert.equal(result.paid,false);
});
test('invalid satang, negative, decimal or missing reviewed basis fail before DB',async()=>{
 let calls=0;const h=make({hrCreatePayrollReviewLine:async()=>{calls++;return{};}});
 for(const bad of [{...data,baseSatang:2000000},{...data,baseSatang:'-10'},
  {...data,taxSatang:'1.5'},{...data,otherEarningsSatang:'1e3'},
  {...data,adjustmentSatang:'-1.1'},{...data,otherDeductionsSatang:'10000000001'},
  {...data,endDate:'2026-02-30'},{...data,basis:'too short'}]){
  const result=await h(req('/api/hr/payroll/drafts/line',bad));
  assert.equal(result.status,400);
 }
 assert.equal(calls,0);
});
test('second reviewer sees draft but approval is still not bank settlement',async()=>{
 const h=make({hrReviewPayrollDraft:async x=>{
  assert.equal(x.actorId,actor);assert.equal(x.runId,run);
  assert.equal(x.approved,true);
  return{id:run,status:'review',reviewed:true,paid:false};
 }});
 const r=await h(req('/api/hr/payroll/drafts/review',{runId:run,approved:true,
  legalBasis:'Reviewed source, social security and tax evidence for synthetic payroll only'}));
 assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.paid,false);assert.equal(body.posted,false);
 assert.equal(body.payable,false);assert.equal(body.result.status,'review');
});
test('scoped draft list and denied arbitrary user',async()=>{
 const h=make({hrListPayrollDrafts:async x=>{
  assert.deepEqual(x,{actorId:actor,stationId:employee});return[];
 }});
 const r=await h(req('/api/hr/payroll/drafts?stationId='+employee));
 assert.equal(r.status,200);assert.deepEqual((await r.json()).drafts,[]);
 assert.equal((await h(req('/api/hr/payroll/drafts?stationId='+employee,null,'bad'))).status,401);
});
test('self review, stale source and duplicates are fail-closed',async()=>{
 for(const [name,status] of [['FORBIDDEN',403],['SELF_APPROVAL_FORBIDDEN',403],
  ['PAYROLL_SOURCE_CHANGED',409],['DUPLICATE_PAYROLL_LINE',409],
  ['PAYROLL_PERIOD_LOCKED',409],['PAYROLL_EVIDENCE_UNREVIEWED',409]]){
  const h=make({hrReviewPayrollDraft:async()=>{let e=new Error('db');e.code=name;throw e;}});
  const r=await h(req('/api/hr/payroll/drafts/review',{runId:run,approved:true,
   legalBasis:'Independent assessment of wage and statutory documents, reviewed'}));
  assert.equal(r.status,status,name);
 }
});
test('unknown origin and invalid review cannot trigger DB',async()=>{
 const h=make({hrCreatePayrollReviewLine:async()=>{throw Error('should not call');}});
 assert.equal((await h(req('/api/hr/payroll/drafts/line',data,'good','https://evil.example'))).status,403);
 assert.equal((await h(req('/api/hr/payroll/drafts/review',{runId:run,approved:'yes',
  legalBasis:'x'.repeat(50)}))).status,400);
});
test('SQL writes only draft/review and never actual payout or advance repayment',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261101230000_hr_payroll_review_draft.sql',import.meta.url),'utf8');
 for(const text of ['CREATE OR REPLACE FUNCTION public.hr_create_payroll_review_line',
  'CREATE OR REPLACE FUNCTION public.hr_review_payroll_draft_safe',
  'CREATE OR REPLACE FUNCTION public.hr_list_payroll_drafts_safe',
  'SECURITY DEFINER SET search_path','PAYROLL_EVIDENCE_UNREVIEWED',
  'SELF_APPROVAL_FORBIDDEN','PAYROLL_SOURCE_CHANGED','REVOKE ALL ON FUNCTION',
  'TO service_role','noMoneyTransfer'])assert.ok(sql.includes(text),text);
 assert.match(sql,/attendancePunches'\)::integer=0/);
 const fix=readFileSync(new URL('../../supabase/migrations/20261101231000_hr_payroll_attendance_guard.sql',import.meta.url),'utf8');
 assert.match(fix,/attendancePunches'\)::integer=0/);
 assert.match(fix,/REVOKE ALL ON FUNCTION/);
 const status=readFileSync(new URL('../../supabase/migrations/20261101232000_hr_payroll_accepted_attendance_timezone.sql',import.meta.url),'utf8');
 assert.match(status,/IS DISTINCT FROM 'accepted'/);
 assert.match(status,/AT TIME ZONE v_station_tz/);
 const provenance=readFileSync(new URL('../../supabase/migrations/20261101233000_hr_payroll_manual_punch_provenance.sql',import.meta.url),'utf8');
 assert.match(provenance,/hr_reviewed_attendance_punches_local/);
 assert.match(provenance,/verifiedPunches',v_time/);
 assert.match(provenance,/unclosed|v_active OR v_break/);
 assert.match(provenance,/PAYROLL_SOURCE_CHANGED/);
 assert.match(provenance,/REVOKE ALL ON FUNCTION/);

 assert.doesNotMatch(sql,/INSERT INTO public\.payroll_payouts|UPDATE public\.payroll_payouts/i);
 assert.doesNotMatch(sql,/INSERT INTO public\.advance_repayments|UPDATE public\.salary_advances/i);
 assert.doesNotMatch(sql,/status='paid'|status='paying'|status='approved'/);
});
test('draft UI has no local private payroll storage and presents independent reviewer workflow',()=>{
 const ui=readFileSync(new URL('../../src/client/hr-payroll-draft.js',import.meta.url),'utf8');
 const host=readFileSync(new URL('../../src/client/attendance-payroll-preview.js',import.meta.url),'utf8');
 assert.match(host,/mountHrPayrollDraft/);
 assert.match(ui,/สร้างร่างเงินเดือนส่งให้ฝ่ายบัญชีตรวจ/);
 assert.match(ui,/ยังไม่จ่ายเงิน ไม่ส่งธนาคาร/);
 assert.match(ui,/ตรวจร่างโดยผู้อนุมัติคนละบัญชี/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|innerHTML/);
});
