import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// Real user actions in one fixed fictional QA station. No real payroll payout.
const BASE='https://oilstation.goldensoft.cloud';
const station='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const employeeCode='QA261101S01A';
const secret=()=>{const v=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!v)throw Error('Protected QA Sales01 credential is missing');return v;};
const password=suffix=>createHmac('sha256',secret())
 .update('OilStation QA station role account 20261031/v1/s01a-'+suffix)
 .digest('base64url').slice(0,30)+'a9!';
const get=(page,token,path)=>page.request.get(BASE+path,{headers:{authorization:'Bearer '+token}});
const post=(page,token,path,data)=>page.request.post(BASE+path,{headers:{
 authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},data});
async function login(page,suffix){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill('s01a-'+suffix);
 await page.locator('#qa-login-password').fill(password(suffix));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="hr"]:visible').first()).toBeVisible({timeout:35000});
 return page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(k.startsWith('sb-')&&k.endsWith('-auth-token'))
    try{return JSON.parse(localStorage.getItem(k))?.access_token||null;}catch{}
  }return null;
 });
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-HR-02 actual OT partial approval and shift substitution by independent reviewer @qa-business-approvals',async({browser,request})=>{
 test.skip(process.env.OILSTATION_QA_BUSINESS_HR_RUN!=='true',
  'Only bounded protected QA HR browser workflow may mutate isolated fictional fixtures');
 test.setTimeout(5*60*1000);
 const cfg=await request.get(BASE+'/api/public-config');
 expect(cfg.status()).toBe(200);
 expect((await cfg.json()).qaFinanceSimEnabled).toBe(false);
 const owner=await browser.newPage(),hr=await browser.newPage();
 try{
  const ot=await login(owner,'owner'),ht=await login(hr,'hr');
  expect(ot).toBeTruthy();expect(ht).toBeTruthy();
  const r=await get(hr,ht,'/api/hr/roster?stationId='+station);
  expect(r.status()).toBe(200);
  const roster=(await r.json()).roster;
  const employee=roster.employees.find(e=>e.code===employeeCode);
  expect(employee,'Existing QA employee from prior protected UAT').toBeTruthy();
  const original=roster.assignments.find(a=>a.employeeId===employee.id&&a.date==='2026-11-15');
  expect(original,'Existing QA scheduled shift').toBeTruthy();
  expect(['scheduled','absence_review']).toContain(original.status);
  const replacement=roster.shiftTemplates.find(t=>t.id!==original.templateId);
  expect(replacement,'Alternative shift template').toBeTruthy();

  // Real overtime request: 60 minutes, second account approves 45.
  const requested=await post(hr,ht,'/api/hr/request-ot',{
   employeeId:employee.id,shiftId:original.id,planned:true,
   requestedMinutes:60,reason:'QA ขอ OT เพื่อทดสอบการอนุมัติ',
  });
  expect(requested.status()).toBe(201);
  const otId=(await requested.json()).request.requestId;
  expect(otId).toBeTruthy();
  const queue=await get(owner,ot,'/api/hr/pending-ot?stationId='+station);
  expect(queue.status()).toBe(200);
  expect((await queue.json()).requests.some(x=>x.id===otId)).toBe(true);
  const approved=await post(owner,ot,'/api/hr/review-ot',{requestId:otId,approvedMinutes:45});
  expect(approved.status()).toBe(200);
  const accepted=(await approved.json()).result;
  expect(accepted.status).toBe('partial');
  expect(accepted.approvedMinutes).toBe(45);
  const replay=await post(owner,ot,'/api/hr/review-ot',{requestId:otId,approvedMinutes:45});
  expect(replay.status()).toBe(200);
  expect((await replay.json()).result.replayed).toBe(true);
  console.log('QA-HR OT 60 minutes requested and 45 approved by other actor; replay protected');

  // The original shift is only marked replaced after another reviewer confirms.
  const move=await post(hr,ht,'/api/hr/request-substitute',{
   originalAssignmentId:original.id,newTemplateId:replacement.id,
   reason:'QA ขอทำงานแทนกะสำหรับทดสอบ',
  });
  expect(move.status()).toBe(201);
  const moveData=(await move.json()).request;
  expect(moveData.status).toBe('pending');
  const inbox=await get(owner,ot,'/api/hr/pending-substitutes?stationId='+station);
  expect(inbox.status()).toBe(200);
  expect((await inbox.json()).requests.some(x=>x.id===moveData.requestId)).toBe(true);
  const review=await post(owner,ot,'/api/hr/review-substitute',{
   requestId:moveData.requestId,approved:true,
  });
  expect(review.status()).toBe(200);
  expect((await review.json()).result.status).toBe('approved');
  const replayMove=await post(owner,ot,'/api/hr/review-substitute',{
   requestId:moveData.requestId,approved:true,
  });
  expect(replayMove.status()).toBe(200);
  expect((await replayMove.json()).result.replayed).toBe(true);
  const final=await get(owner,ot,'/api/hr/roster?stationId='+station);
  expect(final.status()).toBe(200);
  const updated=(await final.json()).roster;
  expect(updated.assignments.some(a=>a.id===original.id&&a.status==='replaced')).toBe(true);
  expect(updated.assignments.some(a=>a.id===moveData.replacementAssignmentId)).toBe(true);
  console.log('QA-HR approved substitution, original shift marked replaced and replay protected');

  // Preview cannot be confused with payroll approval or actual bank payout.
  const preview=await get(owner,ot,'/api/hr/attendance/payroll-preview?'+new URLSearchParams({
   employeeId:employee.id,startDate:'2026-11-01',endDate:'2026-11-30'}));
  expect([200,409],'Unreviewed/empty punches must not generate payable wages').toContain(preview.status());
  if(preview.status()===200){
   const result=await preview.json();
   expect(result.status).toBe('preview_only');
   expect(result.payable).toBe(false);
   expect(result.faceVerified).toBe(false);
  }
  console.log('QA-HR payroll preview not payable; no real salary export or payment');
 }finally{await Promise.all([owner.close(),hr.close()]);}
});
