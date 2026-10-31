import {test,expect} from '@playwright/test';

// Protected live UAT ONLY. Never runs on pull_request. No secrets in artifacts.
const BASE='https://oilstation.goldensoft.cloud';
function required(k){const v=process.env[k];if(!v)throw Error('Missing protected QA secret '+k);return v;}
async function login(page,alias,secretName,screen){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(required(secretName));
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-go="'+screen+'"]:visible').first()).toBeVisible();
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const v=JSON.parse(localStorage.getItem(key));
    if(typeof v?.access_token==='string')return v.access_token;}catch{}
  }
  return null;
 });
 expect(token,'Supabase QA session persisted').toBeTruthy();
 return token;
}
async function api(page,token,path,method='GET',body=null,extra={}){
 const res=await page.request.fetch(BASE+path,{method,headers:{
  authorization:'Bearer '+token,
  ...(method==='POST'?{'content-type':'application/json',origin:BASE}:{}),
  ...extra,
 },...(body?{data:body}:{})});
 const data=await res.json().catch(()=>({}));
 return {status:res.status(),data,ok:res.ok()};
}
test('QA-F01 real company request, station owner approval, QR reservation and signed driver link @qa-finance',async({browser})=>{
 test.skip(process.env.OILSTATION_QA_FINANCE_AUTH_RUN!=='true',
  'Only protected workflow_dispatch on deployed main may execute finance UAT');
 required('OILSTATION_QA_C01_ADMIN_PASSWORD');
 required('OILSTATION_QA_C01_DRIVER_PASSWORD');
 required('OILSTATION_QA_S01A_OWNER_PASSWORD');
 const corp=await browser.newPage();
 const owner=await browser.newPage();
 const driverPage=await browser.newPage();
 try{
  const cfg=await corp.request.get(BASE+'/api/public-config');
  expect(cfg.status()).toBe(200);
  expect((await cfg.json()).qaFinanceSimEnabled,'QA finance switch must be explicitly enabled').toBe(true);
  const ct=await login(corp,'c01-admin','OILSTATION_QA_C01_ADMIN_PASSWORD','corporate');
  const ot=await login(owner,'s01a-owner','OILSTATION_QA_S01A_OWNER_PASSWORD','finance');

  await corp.locator('[data-ws-go="corporate"]:visible').first().click();
  await expect(corp.locator('#qa-topup-workspace')).toBeVisible();
  await owner.locator('[data-ws-go="finance"]:visible').first().click();
  await expect(owner.getByText('อนุมัติเติมเงินจำลอง (QA)')).toBeVisible();

  const accounts=await api(corp,ct,'/api/my-accounts');
  expect(accounts.status).toBe(200);
  const a=(accounts.data.accounts||[]).find(x=>
   x.stationName==='QA-S01-A'&&x.companyName==='QA-S01-A-C01');
  expect(a,'Fixed QA station account must be present').toBeTruthy();
  // Check the real company driver identity BEFORE any financial writes.
  const dispatch=await api(corp,ct,'/api/corporate/drivers?companyId='+a.companyId);
  expect(dispatch.status).toBe(200);
  const driverMember=(dispatch.data.drivers||[]).find(d=>d.userId);
  expect(driverMember,'QA company driver must already have a role-scoped membership').toBeTruthy();
  const driverToken=await login(driverPage,'c01-driver','OILSTATION_QA_C01_DRIVER_PASSWORD','driver');
  await driverPage.locator('[data-ws-go="driver"]:visible').first().click();
  await expect(driverPage.locator('#driver-workspace')).toBeVisible();
  // Dispatch via company-authorized API. This does not credit the wallet.
  const assignment=await api(corp,ct,'/api/corporate/driver-vehicle','POST',{
    companyId:a.companyId,driverUserId:driverMember.userId,plate:'กข 1234',
  });
  expect(assignment.status).toBe(200);
  const driverId=assignment.data.assignment.driverId;
  expect(driverId).toBeTruthy();
  // Read-only fuel preflight; no topup if the station is not priced.
  const fuel=await api(corp,ct,'/api/my-accounts/'+encodeURIComponent(a.id)+'/fuels');
  expect(fuel.status).toBe(200);
  const firstFuel=(fuel.data.fuels||[])[0];
  expect(firstFuel,'UAT prerequisite: enable and price one QA-only fuel product').toBeTruthy();
  const before=BigInt(a.availableSatang);
  const amount='10000'; // 100 THB synthetic only; well below hard per-item cap.
  const key=crypto.randomUUID();
  const request=await api(corp,ct,'/api/qa/finance/topup/request','POST',
   {accountId:a.id,amountSatang:amount,requestKey:key});
  expect(request.status,JSON.stringify(request.data)).toBe(201);
  expect(request.data.request.status).toBe('pending');
  const requestId=request.data.request.requestId;
  const preApproval=await api(corp,ct,'/api/my-accounts');
  const pendingBalance=(preApproval.data.accounts||[]).find(x=>x.id===a.id);
  expect(BigInt(pendingBalance.availableSatang)).toBe(before);

  const scopes=await api(owner,ot,'/api/qa/scopes');
  expect(scopes.status).toBe(200);
  const station=(scopes.data.scopes?.station||[]).find(x=>x.name==='QA-S01-A');
  expect(station,'Owner QA station scope missing').toBeTruthy();
  const queue=await api(owner,ot,'/api/qa/finance/topup/pending?stationId='+station.id);
  expect(queue.status).toBe(200);
  expect(queue.data.requests.some(x=>x.requestId===requestId)).toBe(true);
  const approval=await api(owner,ot,'/api/qa/finance/topup/review','POST',
   {requestId,approved:true});
  expect(approval.status,JSON.stringify(approval.data)).toBe(200);
  expect(approval.data.result.status).toBe('approved');
  expect(approval.data.result.simulated).toBe(true);
  const replay=await api(owner,ot,'/api/qa/finance/topup/review','POST',
   {requestId,approved:true});
  expect(replay.status).toBe(200);
  expect(replay.data.result.replayed).toBe(true);

  const after=await api(corp,ct,'/api/my-accounts');
  const newBalance=BigInt((after.data.accounts||[]).find(x=>x.id===a.id)?.availableSatang);
  expect(newBalance).toBe(before+BigInt(amount));

  const maxAmount='5000'; // 50 THB reserved, no real bank charge.
  const issue=await api(corp,ct,'/api/coupons','POST',{
   accountId:a.id,stationFuelId:firstFuel.id,amountSatang:maxAmount,
   driverId,
   expiresAt:new Date(Date.now()+24*60*60*1000).toISOString(),
  },{'idempotency-key':crypto.randomUUID().replaceAll('-','')});
  expect(issue.status,JSON.stringify(issue.data)).toBe(201);
  expect(issue.data.coupon?.qrPayload).toBeTruthy();
  const balanceAfterIssue=await api(corp,ct,'/api/my-accounts');
  expect(BigInt((balanceAfterIssue.data.accounts||[]).find(x=>x.id===a.id).availableSatang))
   .toBe(newBalance-BigInt(maxAmount));

  const shareUrl=issue.data.coupon?.shareUrl;
  expect(shareUrl).toBeTruthy();
  const sharedToken=new URL(shareUrl).pathname.split('/').pop();
  const driver=await corp.request.get(BASE+'/api/coupon-view?token='+encodeURIComponent(sharedToken));
  expect(driver.status()).toBe(200);
  expect((await driver.json()).id).toBe(issue.data.coupon.couponId??issue.data.coupon.id);
  const ownInbox=await api(driverPage,driverToken,'/api/driver/coupons');
  expect(ownInbox.status).toBe(200);
  expect(ownInbox.data.vehicles.some(x=>x.plate==='กข 1234')).toBe(true);
  const assigned=ownInbox.data.coupons.find(x=>x.id===issue.data.coupon.id);
  expect(assigned,'QR must appear only inside assigned driver account').toBeTruthy();
  expect(assigned.qrPayload).toBe(issue.data.coupon.qrPayload);
  await driverPage.locator('[data-ws-go="driver"]:visible').first().click();
  await driverPage.getByRole('button',{name:'รีเฟรชคูปอง'}).click();
  await expect(driverPage.locator('#driver-workspace canvas')).toBeVisible();
  const scan=await api(owner,ot,'/api/station/scan-qr','POST',
   {qrPayload:issue.data.coupon.qrPayload});
  expect(scan.status,JSON.stringify(scan.data)).toBe(200);
  expect(scan.data.coupon.stationName).toBe('QA-S01-A');
  // Deliberately stop before fueling. Photo must be provided and manually
  // approved by a different station actor in the dedicated human UAT phase.
 }finally{await Promise.all([corp.close(),owner.close(),driverPage.close()]);}
});
