import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHrPaymentApi} from '../../src/api/hr-payments.mjs';
const BASE='https://oilstation.goldensoft.cloud';
const ID='11111111-1111-4111-8111-111111111111', EMP='22222222-2222-4222-8222-222222222222';
const ADV='33333333-3333-4333-8333-333333333333', PAYEE='44444444-4444-4444-8444-444444444444';
const CLAIM='55555555-5555-4555-8555-555555555555';
const request=(path,body,token='good')=>new Request(BASE+path,{method:body?'POST':'GET',
 headers:{authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},
 ...(body?{body:JSON.stringify(body)}:{})});
function handler({isQa=false,db={}}={}){
 return createHrPaymentApi({authenticate:async token=>token==='good'?{id:ID,isQa}:null,
 db:{
  hrSubmitAdvanceConfirmation:async()=>({id:CLAIM,status:'pending',disbursed:false}),
  hrListAdvanceConfirmations:async()=>[],
  hrReviewAdvanceConfirmation:async()=>({id:CLAIM,status:'rejected',deducted:false}),
  ...db,
 }});
}
test('manual bank transfer claim requires valid advance and approved payee IDs',async()=>{
 let count=0;
 const api=handler({db:{hrSubmitAdvanceConfirmation:async x=>{
  count++;assert.equal(x.actorId,ID);assert.equal(x.advanceId,ADV);
  assert.equal(x.methodId,PAYEE);assert.equal(x.bankReference,'BKTREF-123456');
  return {id:CLAIM,status:'pending',disbursed:false};
 }}});
 const good=await api(request('/api/hr/advances/manual-confirmation/submit',{
  advanceId:ADV,methodId:PAYEE,bankReference:'BKTREF-123456'}));
 assert.equal(good.status,201);const body=await good.json();
 assert.equal(body.claim.status,'pending');assert.equal(body.deducted,false);
 assert.equal(body.automaticTransfer,false);assert.equal(count,1);
 assert.equal((await api(request('/api/hr/advances/manual-confirmation/submit',{
  advanceId:ADV,methodId:PAYEE,bankReference:'SHORT'}))).status,400);
 assert.equal(count,1);
});
test('QA test identities cannot attest fake bank transfers as real',async()=>{
 let calls=0;
 const qa=handler({isQa:true,db:{hrReviewAdvanceConfirmation:async()=>{calls++;return{};}}});
 const result=await qa(request('/api/hr/advances/manual-confirmation/review',{
  claimId:CLAIM,verified:true}));
 assert.equal(result.status,403);
 assert.equal((await result.json()).error,'qa_real_disbursement_forbidden');
 assert.equal(calls,0);
});
test('QA can reject a fictional manual evidence claim without paying it',async()=>{
 let called=0;
 const qa=handler({isQa:true,db:{hrReviewAdvanceConfirmation:async x=>{
  called++;assert.equal(x.verified,false);
  return {id:CLAIM,status:'rejected',deducted:false};
 }}});
 const r=await qa(request('/api/hr/advances/manual-confirmation/review',{
  claimId:CLAIM,verified:false}));
 assert.equal(r.status,200);const b=await r.json();
 assert.equal(b.claim.status,'rejected');assert.equal(b.deducted,false);assert.equal(called,1);
});
test('only manager-scoped DB RPC permits reading masked confirmation inbox',async()=>{
 const api=handler({db:{hrListAdvanceConfirmations:async x=>{
  assert.deepEqual(x,{actorId:ID,employeeId:EMP});
  return [{id:CLAIM,status:'pending',maskedBankReference:'••••3456'}];
 }}});
 const r=await api(request('/api/hr/advances/manual-confirmations?employeeId='+EMP));
 assert.equal(r.status,200);const b=await r.json();
 assert.deepEqual(b.items,[{id:CLAIM,status:'pending',maskedBankReference:'••••3456'}]);
});
test('other station, duplicate claim and self approval are failed closed by DB errors',async()=>{
 for(const [code,status] of [['FORBIDDEN',403],['SELF_APPROVAL_FORBIDDEN',403],
  ['CLAIM_ALREADY_EXISTS',409],['ADVANCE_NOT_APPROVED',409],
  ['PAYEE_NOT_APPROVED',409]]){
  const api=handler({db:{hrSubmitAdvanceConfirmation:async()=>{let e=new Error('db');e.code=code;throw e;}}});
  const r=await api(request('/api/hr/advances/manual-confirmation/submit',{
   advanceId:ADV,methodId:PAYEE,bankReference:'BKTREF-123456'}));
  assert.equal(r.status,status,code);
 }
});
test('migration prevents duplicate external bank refs, requires two actors and no auto payroll',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261101200000_hr_manual_advance_disbursement.sql',import.meta.url),'utf8');
 for(const phrase of ['CREATE UNIQUE INDEX','station_id,bank_reference',
  'status IN (','p_actor_id=c.submitted_by','hr_advance_review_manual_confirmation',
  'salary_advances SET status=','noPayrollDeduction','REVOKE ALL ON FUNCTION','TO service_role',
  'FORCE ROW LEVEL SECURITY'])assert.ok(sql.includes(phrase),phrase);
 assert.doesNotMatch(sql,/UPDATE public.payroll_lines|INSERT INTO public.advance_repayments|UPDATE public.payroll_payouts/);
});
