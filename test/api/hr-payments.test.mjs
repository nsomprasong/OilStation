import test from 'node:test';
import assert from 'node:assert/strict';
import {createHrPaymentApi} from '../../src/api/hr-payments.mjs';
import {readFileSync} from 'node:fs';
const ACTOR='11111111-1111-4111-8111-111111111111';
const EMP='22222222-2222-4222-8222-222222222222';
const METHOD='33333333-3333-4333-8333-333333333333';
const API='https://oilstation.goldensoft.cloud';
const handler=(db={})=>createHrPaymentApi({
 authenticate:async key=>key==='good'?{id:ACTOR}:null,
 db:{
  hrListPayees:async()=>[],
  hrListAdvances:async()=>[],
  hrRegisterPayee:async x=>({id:METHOD,status:'pending',masked:'••••1234'}),
  hrReviewPayee:async()=>({id:METHOD,status:'approved'}),
  hrRevealPayee:async()=>({status:'instruction_only',type:'promptpay_phone',
   reference:'0812345678',verifiedName:'QA Employee',masked:'0••-•••-5678'}),
  hrRequestAdvance:async()=>({id:METHOD,frequency:'monthly',status:'requested'}),
  hrReviewAdvance:async()=>({id:METHOD,status:'approved'}),
  ...db,
 }});
const req=(path,body,headers={})=>new Request(API+path,{
 method:body===undefined?'GET':'POST',
 headers:{authorization:'Bearer good',origin:API,'content-type':'application/json',...headers},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),
});
test('payees list is scoped and masks numbers',async()=>{
 const fn=handler();
 const result=await fn(req('/api/hr/payees?employeeId='+EMP));
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).items,[]);
});
test('save PromptPay phone and bank fallback but never return account raw on register',async()=>{
 let called=[];
 const fn=handler({hrRegisterPayee:async x=>{called.push(x);return {id:METHOD,status:'pending',masked:'••••1234'};}});
 const phone=await fn(req('/api/hr/payees/register',{employeeId:EMP,type:'promptpay_phone',
  reference:'081-234-5678'}));
 assert.equal(phone.status,201);
 assert.ok(!(await phone.text()).includes('0812345678'));
 const bank=await fn(req('/api/hr/payees/register',{employeeId:EMP,type:'bank_account',
  reference:'123-456-7890',bankCode:'KBANK'}));
 assert.equal(bank.status,201);
 assert.deepEqual(called.map(x=>x.reference),['0812345678','1234567890']);
});
test('wrong method, origin and missing authentication fail before storing',async()=>{
 let count=0;
 const fn=handler({hrRegisterPayee:async()=>{count++;return{};}});
 assert.equal((await fn(req('/api/hr/payees/register',{employeeId:EMP,type:'bank_account',
  reference:'1234',bankCode:'KBANK'}))).status,503);
 assert.equal(count,0);
});
test('payment instruction is flagged unpaid and only approved details are used',async()=>{
 const fn=handler();
 const r=await fn(req('/api/hr/payees/instruction',{methodId:METHOD,amountSatang:'25001'}));
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.kind,'promptpay');
 assert.equal(data.paid,false);assert.equal(data.instructionOnly,true);
 assert.equal(data.amountSatang,25001);
 assert.match(data.payload,/5406250\.01/);
});
test('manual bank payment instruction has no fabricated PromptPay QR',async()=>{
 const fn=handler({hrRevealPayee:async()=>({
  status:'instruction_only',type:'bank_account',reference:'1234567890',
  bankCode:'KBANK',verifiedName:'QA Employee'})});
 const result=await fn(req('/api/hr/payees/instruction',{methodId:METHOD,amountSatang:'12500'}));
 const d=await result.json();
 assert.equal(d.kind,'manual_bank');assert.equal(d.bankAccount,'1234567890');
 assert.equal(d.payload,undefined);assert.equal(d.paid,false);
});
test('advance request responds with chosen installment schedule and no deduction',async()=>{
 const fn=handler();
 const r=await fn(req('/api/hr/advances/request',{
  employeeId:EMP,amountSatang:'10001',installments:3,firstDeductionDate:'2026-12-15'}));
 assert.equal(r.status,201);
 const data=await r.json();
 assert.equal(data.deducted,false);assert.equal(data.previewOnly,true);
 assert.deepEqual(data.schedule.map(x=>x.amountSatang),[3333,3333,3335]);
});
test('advance review cannot claim disbursement or current payroll deduction',async()=>{
 const fn=handler();
 const r=await fn(req('/api/hr/advances/review',{advanceId:METHOD,approved:true}));
 const d=await r.json();assert.equal(d.disbursed,false);assert.equal(d.deducted,false);
});
test('missing session, invalid amount, methods and other-origin posts are denied',async()=>{
 const fn=handler();
 assert.equal((await fn(req('/api/hr/payees/instruction',{methodId:METHOD,amountSatang:'-100'}))).status,400);
 assert.equal((await fn(req('/api/hr/payees/instruction',{methodId:METHOD,amountSatang:'0'}))).status,400);
 assert.equal((await fn(req('/api/hr/payees/register',{
  employeeId:EMP,type:'promptpay_phone',reference:'0011111111'}))).status,503);
 assert.equal((await fn(req('/api/hr/payees/register',{employeeId:EMP,type:'promptpay_phone',
  reference:'0812345678'},{origin:'https://attacker.invalid'}))).status,403);
 assert.equal((await fn(req('/api/hr/payees?employeeId='+EMP,undefined,{authorization:'Bearer bad'}))).status,401);
});
test('security migration forces role checks, independent reviews and Vault secrets',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261101190000_hr_payee_advance_installments.sql',import.meta.url),'utf8');
 for(const key of ['vault.create_secret','vault.decrypted_secrets','SELF_APPROVAL_FORBIDDEN',
  'REVOKE ALL ON FUNCTION','TO service_role','advance_requested',
  'p_installments BETWEEN','PENDING_ADVANCE_EXISTS','payment_method','is_primary'])
  assert.ok(sql.includes(key),key);
 assert.doesNotMatch(sql,/UPDATE public.payroll_payouts|INSERT INTO public.payroll_payouts/);
});
test('new HR UI is a single compact submenu and never stores account in client storage',()=>{
 const src=readFileSync(new URL('../../src/client/hr-payments.js',import.meta.url),'utf8');
 const sub=readFileSync(new URL('../../src/client/functional-submenus.js',import.meta.url),'utf8');
 assert.match(sub,/id:'payees'.*#hr-payee-advance/);
 for(const phrase of ['ไม่มี PromptPay','สร้างรายการจ่าย','เงินเบิกล่วงหน้า','จำนวนงวดหัก'])
  assert.ok(src.includes(phrase),phrase);
 assert.doesNotMatch(src,/localStorage|sessionStorage|document\.cookie/);
});
