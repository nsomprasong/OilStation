import {test,expect} from '@playwright/test';

// Runs only inside the existing timeboxed QA HR arm/disarm workflow.
// All calls are anonymous and must be refused before Supabase RPC access.
test.use({trace:'off',screenshot:'off',video:'off'});
test('QA-HR publicly inaccessible even when scoped UAT is armed @qa-business-guard',async({request})=>{
 test.skip(process.env.OILSTATION_QA_BUSINESS_HR_RUN!=='true','Protected QA workflow only');
 const base='https://oilstation.goldensoft.cloud';
 const config=await request.get(base+'/api/public-config');
 expect(config.status()).toBe(200);
 const flags=await config.json();
 expect(flags.qaModeEnabled).toBe(true);
 expect(flags.qaFinanceSimEnabled).toBe(false);
 const employee='22222222-2222-4222-8222-222222222222';
 for(const path of [
  '/api/hr/payees?employeeId='+employee,
  '/api/hr/advances?employeeId='+employee,
  '/api/hr/advances/manual-confirmations?employeeId='+employee,
  '/api/hr/advances/period-preview?employeeId='+employee+
   '&startDate=2026-12-01&endDate=2027-01-01',
 ]){
  const result=await request.get(base+path);
  expect(result.status(),path).toBe(401);
  expect((await result.json()).error,path).toBe('unauthenticated');
 }
 const id='33333333-3333-4333-8333-333333333333';
 const method='44444444-4444-4444-8444-444444444444';
 const claim='55555555-5555-4555-8555-555555555555';
 for(const [path,body] of [
  ['/api/hr/payees/instruction',{methodId:method,amountSatang:'10001'}],
  ['/api/hr/advances/request',{employeeId:employee,amountSatang:'10001',
   installments:3,firstDeductionDate:'2026-12-15'}],
  ['/api/hr/advances/manual-confirmation/submit',{
   advanceId:id,methodId:method,bankReference:'QA-NOT-A-BANK-TRANSFER'}],
  ['/api/hr/advances/manual-confirmation/review',{claimId:claim,verified:true}],
 ]){
  const result=await request.post(base+path,{headers:{
   origin:base,'content-type':'application/json'},data:body});
  expect(result.status(),path).toBe(401);
  expect((await result.json()).error,path).toBe('unauthenticated');
 }
 const forged=await request.post(base+'/api/hr/advances/manual-confirmation/review',{
  headers:{origin:'https://unknown.example','content-type':'application/json'},
  data:{claimId:claim,verified:true}});
 expect(forged.status()).toBe(403);
 expect((await forged.json()).error).toBe('origin_forbidden');
 const payment=await request.get(base+'/api/billing/payment-intent');
 expect(payment.status()).toBe(503);
 expect((await payment.json()).error).toBe('release_not_enabled');
 console.log('QA-HR GATE PASS: anon payees/advances/transfer review denied, finance off');
});
