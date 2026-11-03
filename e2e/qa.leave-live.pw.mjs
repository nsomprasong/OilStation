import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// One bounded, real-browser test against the owner's EXISTING fictional QA staff.
// No bank transfer, coupon issuance, payroll posting, customer notification or real employee.
// No traces, screenshots, videos, cookies, or JWTs in artifacts.
const BASE='https://oilstation.goldensoft.cloud';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const EMPLOYEE_CODE='QA261101S01A';
const RUN='QA-20261103-HR-LEAVE-001';
const REASON_APPROVE=RUN+' approved-annual';
const REASON_REJECT=RUN+' rejected-sick';
const get=(page,token,path)=>page.request.get(BASE+path,{
 headers:{authorization:'Bearer '+token}});
const post=(page,token,path,data)=>page.request.post(BASE+path,{
 headers:{authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},data});
function password(role,station='s01a'){
 const key=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!key)throw Error('Missing protected QA Sales01 secret');
 return createHmac('sha256',key)
  .update('OilStation QA station role account 20261031/v1/'+station+'-'+role)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,role,station='s01a'){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.os-auth-frame')).toBeVisible({timeout:40000});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(station+'-'+role);
 await page.locator('#qa-login-password').fill(password(role,station));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:40000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(k));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token,'protected QA session').toBeTruthy();
 const who=await get(page,token,'/api/me');
 expect(who.status()).toBe(200);
 const data=await who.json();
 expect(data.memberships).toHaveLength(1);
 expect(data.memberships[0].role).toBe(role==='owner'?'station_owner':'hr_manager');
 expect(data.memberships[0].stationId).toBe(station==='s01a'?STATION:'76388e2c-ef36-4656-808b-7d0fbd1d2c35');
 return token;
}
async function showLeave(page){
 const go=page.locator('[data-ws-go="hr"]:visible').first();
 await expect(go).toBeVisible();
 await go.click();
 const host=page.locator('#hr-leave-workspace');
 // First wait for asynchronous roster/payee/leave mount. A premature submenu
 // assertion can otherwise mistake an unfinished HR workspace for a missing tab.
 await expect(host.locator('form select')).toHaveCount(2,{timeout:45000});
 const tab=page.locator('[data-context-for="hr"] [data-os-pane-key="leave"]');
 if(!await tab.count()){
  // Only DOM structure and menu keys are logged; never JWT, employee names,
  // form values, API responses, screenshots or authenticated browser traces.
  const meta=await page.evaluate(()=>({
   activeScreen:document.querySelector('[data-workspace-shell]')?.dataset.activeScreen,
   contexts:[...document.querySelectorAll('[data-context-for]')].map(el=>({
    key:el.dataset.contextFor,hidden:el.hidden,
    tabs:[...el.querySelectorAll('[data-os-pane-key]')].map(b=>b.dataset.osPaneKey)
   })).filter(x=>x.key==='hr'),
   hrChildren:[...document.querySelector('#hr-workspace')?.children||[]].map(el=>({
    tag:el.tagName,id:el.id,cls:el.className?.toString().slice(0,55)
   })),
   leaveParent:document.querySelector('#hr-leave-workspace')?.parentElement?.className,
   alertCount:document.querySelectorAll('[role="alert"]').length
  }));
  console.log('SAFE_HR_SUBMENU_DIAGNOSTIC '+JSON.stringify(meta));
 }
 await expect(tab).toBeVisible({timeout:15000});
 await tab.click();
 await expect(host).toBeVisible();
 return host;
}
const items=async(page,token,employeeId)=>{
 const r=await get(page,token,'/api/hr/leave?employeeId='+employeeId);
 expect(r.status()).toBe(200);
 const data=await r.json();
 expect(data.payrollImpact).toBe('undetermined');
 expect(data.deducted).toBe(false);
 expect(data.payable).toBe(false);
 return data.items;
};
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-HR-LEAVE: two fictional requests, independent owner decisions and no payroll posting @qa-leave-safe',
 async({browser,request})=>{
  test.skip(process.env.OILSTATION_QA_LEAVE_E2E_RUN!=='true',
   'Protected approved one-off QA only, requires scoped 45-minute HR arm/disarm');
  test.setTimeout(12*60*1000);
  const cfg=await request.get(BASE+'/api/public-config');
  expect(cfg.status()).toBe(200);
  const flags=await cfg.json();
  expect(flags.qaModeEnabled).toBe(true);
  expect(flags.qaFinanceSimEnabled).toBe(false);
  const ready=await request.get(BASE+'/api/ready');
  expect(ready.status()).toBe(503);

  const hr=await browser.newPage(),owner=await browser.newPage(),
   foreign=await browser.newPage();
  try{
   const ht=await login(hr,'hr'),ot=await login(owner,'owner'),
    ft=await login(foreign,'hr','s01b');
   const rosterRes=await get(hr,ht,'/api/hr/roster?stationId='+STATION);
   expect(rosterRes.status()).toBe(200);
   const roster=(await rosterRes.json()).roster;
   const employee=roster.employees.find(e=>e.code===EMPLOYEE_CODE);
   expect(employee?.id,'pre-existing fictional QA employee').toBeTruthy();
   const previous=await items(hr,ht,employee.id);
   expect(previous.some(x=>x.reason?.includes(RUN)),
    'never duplicate/overwrite this fixed run or its append-only evidence').toBe(false);

   const foreignRead=await get(foreign,ft,'/api/hr/leave?employeeId='+employee.id);
   expect(foreignRead.status(),'S01-B cannot see S01-A leave').toBe(403);
   const anonymous=await request.get(BASE+'/api/hr/leave?employeeId='+employee.id);
   expect(anonymous.status()).toBe(401);

   const form=await showLeave(hr);
   await form.locator('form select').first().selectOption(employee.id);
   await form.locator('form select').nth(1).selectOption('annual');
   await form.locator('input[type="date"]').first().fill('2026-12-24');
   await form.locator('input[type="date"]').nth(1).fill('2026-12-24');
   await form.locator('input[type="text"]').fill(REASON_APPROVE);
   await form.locator('form button[type=submit]').click();
   await expect(form.getByRole('status')).toContainText('ส่งคำขอลาแล้ว',{timeout:20000});
   let list=await items(hr,ht,employee.id);
   const first=list.filter(x=>x.reason===REASON_APPROVE);
   expect(first).toHaveLength(1);
   expect(first[0].status).toBe('pending');
   console.log('LEAVE-01 PASS: fictional annual leave submitted via Chromium form, id='+first[0].id);

   const self=await post(hr,ht,'/api/hr/leave/review',{requestId:first[0].id,approved:true});
   expect(self.status()).toBe(403);
   const overlap=await post(hr,ht,'/api/hr/leave/request',{
    employeeId:employee.id,leaveType:'personal',startDate:'2026-12-24',
    endDate:'2026-12-24',reason:RUN+' prohibited-overlap'});
   expect(overlap.status()).toBe(409);
   const past=await post(hr,ht,'/api/hr/leave/request',{
    employeeId:employee.id,leaveType:'sick',startDate:'2026-10-01',
    endDate:'2026-10-01',reason:RUN+' prohibited-past'});
   expect(past.status()).toBe(400);
   list=await items(hr,ht,employee.id);
   expect(list.filter(x=>x.reason?.includes(RUN))).toHaveLength(1);
   console.log('LEAVE-02/03 PASS: self-approval 403, cross-station 403, overlap 409, invalid past 400');

   const reviewForm=await showLeave(owner);
   await reviewForm.locator('form select').first().selectOption(employee.id);
   const approved=reviewForm.locator('.module-item').filter({hasText:REASON_APPROVE});
   await expect(approved).toContainText('pending',{timeout:20000});
   await approved.getByRole('button',{name:'อนุมัติคำขอ'}).click();
   await expect(reviewForm.getByRole('status')).toContainText('อนุมัติการลาแล้ว',{timeout:20000});
   list=await items(owner,ot,employee.id);
   const ok=list.find(x=>x.id===first[0].id);
   expect(ok.status).toBe('approved');
   const replay=await post(owner,ot,'/api/hr/leave/review',
    {requestId:first[0].id,approved:true});
   expect(replay.status()).toBe(200);
   const replayed=await replay.json();
   expect(replayed.result.replayed).toBe(true);
   expect(replayed.deducted).toBe(false);
   console.log('LEAVE-04 PASS: independent owner UI approved once; replay idempotent');

   const second=await post(hr,ht,'/api/hr/leave/request',{
    employeeId:employee.id,leaveType:'sick',startDate:'2026-12-28',
    endDate:'2026-12-28',reason:REASON_REJECT});
   expect(second.status()).toBe(201);
   const next=(await second.json()).request;
   expect(next.status).toBe('pending');
   const rejected=await post(owner,ot,'/api/hr/leave/review',
    {requestId:next.id,approved:false});
   expect(rejected.status()).toBe(200);
   const rejectedData=await rejected.json();
   expect(rejectedData.result.status).toBe('rejected');
   expect(rejectedData.deducted).toBe(false);
   expect(rejectedData.payable).toBe(false);
   console.log('LEAVE-05 PASS: independently rejected sick-leave request, id='+next.id);

   await owner.reload({waitUntil:'domcontentloaded'});
   const afterReload=await showLeave(owner);
   await afterReload.locator('form select').first().selectOption(employee.id);
   await expect(afterReload.locator('.module-item').filter({hasText:REASON_APPROVE})).toContainText('approved');
   await expect(afterReload.locator('.module-item').filter({hasText:REASON_REJECT})).toContainText('rejected');
   list=await items(owner,ot,employee.id);
   expect(list.filter(x=>x.reason?.includes(RUN))).toHaveLength(2);
   expect(list.every(x=>x.deducted===false&&x.payable===false)).toBe(true);
   console.log('LEAVE-06 PASS: persisted read-only leave statuses reloaded; no automatic payroll impact');
  }finally{await Promise.allSettled([hr.close(),owner.close(),foreign.close()]);}
 });
