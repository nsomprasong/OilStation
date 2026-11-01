import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
// Scoped QA only, no bank transfer or real employee payroll run.
const BASE='https://oilstation.goldensoft.cloud';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
function password(role){
 const secret=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!secret)throw new Error('Missing scoped QA secret');
 return createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/s01a-'+role)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,role){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill('s01a-'+role);
 await page.locator('#qa-login-password').fill(password(role));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="hr"]:visible').first()).toBeVisible({timeout:40000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(k.startsWith('sb-')&&k.endsWith('-auth-token')){
    try{return JSON.parse(localStorage.getItem(k))?.access_token??null;}catch{}
   }
  }return null;
 });
 expect(token).toBeTruthy();
 return token;
}
const get=(page,token,path)=>page.request.get(BASE+path,{headers:{authorization:'Bearer '+token}});
const post=(page,token,path,body)=>page.request.post(BASE+path,{
 headers:{authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},data:body,
});
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-HR-03 Vault payee bank fallback, PromptPay QR, independent review, installment advance @qa-business-payees',
 async({browser,request})=>{
  test.skip(process.env.OILSTATION_QA_BUSINESS_HR_RUN!=='true','Only dedicated armed HR QA');
  test.setTimeout(7*60*1000);
  const cfg=await request.get(BASE+'/api/public-config');
  expect(cfg.status()).toBe(200);
  expect((await cfg.json()).qaFinanceSimEnabled).toBe(false);
  const owner=await browser.newPage(),hr=await browser.newPage();
  try{
   const ownerToken=await login(owner,'owner'),hrToken=await login(hr,'hr');
   await owner.locator('[data-ws-go="hr"]:visible').first().click();
   await expect(owner.locator('#hr-payee-advance')).toContainText('บัญชีรับเงิน');
   const rosterR=await get(hr,hrToken,'/api/hr/roster?stationId='+STATION);
   expect(rosterR.status()).toBe(200);
   const employee=(await rosterR.json()).roster.employees.find(e=>e.code==='QA261101S01A');
   expect(employee).toBeTruthy();
   const initialBank=await get(hr,hrToken,'/api/hr/payees?employeeId='+employee.id);
   expect(initialBank.status()).toBe(200);
   const created=await post(hr,hrToken,'/api/hr/payees/register',{
    employeeId:employee.id,type:'bank_account',reference:'999000001234',bankCode:'KBANK'});
   expect(created.status()).toBe(201);
   const bank=(await created.json()).payee;
   expect(bank.masked).toBe('••••1234');
   expect(JSON.stringify(bank)).not.toContain('999000001234');
   const ownReview=await post(hr,hrToken,'/api/hr/payees/review',{
    methodId:bank.id,approved:true,verifiedName:'QA DO NOT TRANSFER'});
   expect(ownReview.status()).toBe(403);
   const pending=await get(owner,ownerToken,'/api/hr/payees?employeeId='+employee.id);
   expect(pending.status()).toBe(200);
   expect(JSON.stringify(await pending.json())).not.toContain('999000001234');
   const reviewed=await post(owner,ownerToken,'/api/hr/payees/review',{
    methodId:bank.id,approved:true,verifiedName:'QA DO NOT TRANSFER'});
   expect(reviewed.status()).toBe(200);
   expect((await reviewed.json()).result.status).toBe('approved');
   const r=await post(owner,ownerToken,'/api/hr/payees/instruction',{
    methodId:bank.id,amountSatang:'12345'});
   expect(r.status()).toBe(200);
   const bankInstruction=await r.json();
   expect(bankInstruction.kind).toBe('manual_bank');
   expect(bankInstruction.bankAccount).toBe('999000001234');
   expect(bankInstruction.payload).toBeUndefined();
   expect(bankInstruction.paid).toBe(false);
   console.log('QA-HR PAYEE BANK PASS: Vault masked listing, independent approval, manual instructions only');

   // Invalid unregistered mock ID. QR is never scanned or paid.
   const newPP=await post(hr,hrToken,'/api/hr/payees/register',{
    employeeId:employee.id,type:'promptpay_national_id',reference:'0000000000000'});
   expect(newPP.status()).toBe(201);
   const pp=(await newPP.json()).payee;
   expect(pp.masked).toBe('•••••••••0000');
   const ppReview=await post(owner,ownerToken,'/api/hr/payees/review',{
    methodId:pp.id,approved:true,verifiedName:'QA SYNTHETIC NOT A BENEFICIARY'});
   expect(ppReview.status()).toBe(200);
   const qr=await post(owner,ownerToken,'/api/hr/payees/instruction',{
    methodId:pp.id,amountSatang:'10001'});
   expect(qr.status()).toBe(200);
   const qrData=await qr.json();
   expect(qrData.kind).toBe('promptpay');
   expect(qrData.paid).toBe(false);
   expect(qrData.instructionOnly).toBe(true);
   expect(qrData.payload).toContain('5406100.01');
   console.log('QA-HR PROMPTPAY PASS: fixed-value synthetic QR, no transfer/paid status');

   const next=new Date();const first=new Date(Date.UTC(
    next.getUTCFullYear(),next.getUTCMonth()+1,15)).toISOString().slice(0,10);
   const adv=await post(hr,hrToken,'/api/hr/advances/request',{
    employeeId:employee.id,amountSatang:'10001',installments:3,firstDeductionDate:first});
   expect(adv.status()).toBe(201);
   const payload=await adv.json();
   expect(payload.previewOnly).toBe(true);expect(payload.deducted).toBe(false);
   expect(payload.schedule.map(x=>x.amountSatang)).toEqual([3333,3333,3335]);
   const badSelf=await post(hr,hrToken,'/api/hr/advances/review',{
    advanceId:payload.advance.id,approved:true});
   expect(badSelf.status()).toBe(403);
   const review=await post(owner,ownerToken,'/api/hr/advances/review',{
    advanceId:payload.advance.id,approved:true});
   expect(review.status()).toBe(200);
   const result=await review.json();
   expect(result.disbursed).toBe(false);expect(result.deducted).toBe(false);
   expect(result.result.status).toBe('approved');
   const replay=await post(owner,ownerToken,'/api/hr/advances/review',{
    advanceId:payload.advance.id,approved:true});
   expect(replay.status()).toBe(200);
   expect((await replay.json()).result.replayed).toBe(true);
   console.log('QA-HR ADVANCE PASS: 3 selected installments, independent approval, no actual deduction');
   // Following approval, the stored plan remains visible, but no wages are
   // deducted until an externally verified disbursement and payroll approval.
   const currentMonth=first.slice(0,8)+'01';
   const nextMonthDate=new Date(first+'T00:00:00.000Z');
   nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth()+1);
   nextMonthDate.setUTCDate(1);
   const nextMonth=nextMonthDate.toISOString().slice(0,10);
   const readiness=await get(owner,ownerToken,'/api/hr/advances/period-preview?'+
     new URLSearchParams({employeeId:employee.id,startDate:currentMonth,endDate:nextMonth}));
   expect(readiness.status()).toBe(200);
   const plan=await readiness.json();
   expect(plan.payable).toBe(false);
   expect(plan.readOnly).toBe(true);
   expect(plan.deductibleSatang).toBe(0);
   expect(plan.postedSatang).toBe(0);
   const reviewedPlan=plan.items.find(x=>x.advanceId===payload.advance.id);
   expect(reviewedPlan).toBeTruthy();
   expect(reviewedPlan.plannedInPeriodSatang).toBe(3333);
   expect(reviewedPlan.blockers).toContain('advance_not_disbursed');
   const repeat=await get(owner,ownerToken,'/api/hr/advances/period-preview?'+
     new URLSearchParams({employeeId:employee.id,startDate:currentMonth,endDate:nextMonth}));
   expect(repeat.status()).toBe(200);
   expect((await repeat.json()).postedSatang).toBe(0);
   console.log('QA-HR ADVANCE PERIOD PASS: persisted installments reloaded, no payroll deduction');
  }finally{await Promise.all([owner.close(),hr.close()]);}
 });
