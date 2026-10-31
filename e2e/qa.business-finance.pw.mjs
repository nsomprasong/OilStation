import {test,expect} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';

// Live synthetic QA flows only (not a real receipt, bank transfer or fuel pump).
// The production finance API remains globally disabled.
const BASE='https://oilstation.goldensoft.cloud';
const station='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const company='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
const sales='OILSTATION_QA_SALES01_PASSWORD';
function pwd(alias){
 const secret=process.env[sales];
 if(!secret)throw Error('QA Sales01 credential missing');
 const owner=createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/s01a-owner')
  .digest('base64url').slice(0,30)+'a9!';
 if(alias==='s01a-owner')return owner;
 return createHmac('sha256',owner)
  .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function signIn(page,alias,screen){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(pwd(alias));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="'+screen+'"]:visible').first()).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(k));
    if(typeof s?.access_token==='string')return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 return token;
}
async function api(page,token,path,method='GET',body=null,headers={}){
 const r=await page.request.fetch(BASE+path,{
  method,headers:{authorization:'Bearer '+token,
   ...(method==='POST'?{origin:BASE,'content-type':'application/json'}:{}),...headers},
  ...(body!==null?{data:body}:{})});
 const data=await r.json().catch(()=>({}));
 return {status:r.status(),data};
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-FIN-01 company to station simulated topup, approval, QR hold and driver @qa-business-finance',async({browser})=>{
 test.skip(process.env.OILSTATION_QA_BUSINESS_FINANCE_RUN!=='true',
  'Requires protected scoped temporary QA financing gate on matching deploy.');
 test.setTimeout(12*60*1000);
 const corp=await browser.newPage(),owner=await browser.newPage(),driver=await browser.newPage();
 try{
  const config=await corp.request.get(BASE+'/api/public-config');
  expect(config.status()).toBe(200);
  expect((await config.json()).qaFinanceSimEnabled).toBe(true);
  const ct=await signIn(corp,'c01-admin','corporate');
  const ot=await signIn(owner,'s01a-owner','finance');
  const dt=await signIn(driver,'c01-driver','driver');
  const my=await api(corp,ct,'/api/my-accounts');
  expect(my.status).toBe(200);
  const account=my.data.accounts.find(a=>a.companyId===company&&a.stationName==='QA-S01-A');
  expect(account).toBeTruthy();
  const before=BigInt(account.availableSatang);
  const roster=await api(corp,ct,'/api/corporate/drivers?companyId='+company);
  expect(roster.status).toBe(200);
  const assigned=roster.data.drivers.find(d=>d.userId&&d.driverId&&d.plate);
  expect(assigned,'pre-existing driver-vehicle QA fixture').toBeTruthy();
  const fuel=await api(corp,ct,'/api/my-accounts/'+account.id+'/fuels');
  expect(fuel.status).toBe(200);
  const firstFuel=fuel.data.fuels?.find(f=>f.id);
  expect(firstFuel,'existing positively-priced fuel QA fixture').toBeTruthy();
  const ownScopes=await api(owner,ot,'/api/qa/scopes');
  expect(ownScopes.status).toBe(200);
  expect(ownScopes.data.scopes.station.some(s=>s.id===station)).toBe(true);

  const wrong=await api(corp,ct,'/api/qa/finance/topup/request','POST',{
   accountId:'00000000-0000-4000-8000-000000000000',amountSatang:'10000',requestKey:randomUUID()});
  expect([400,403,404]).toContain(wrong.status);

  const submitted=await api(corp,ct,'/api/qa/finance/topup/request','POST',
   {accountId:account.id,amountSatang:'10000',requestKey:randomUUID()});
  expect(submitted.status,JSON.stringify(submitted.data)).toBe(201);
  expect(submitted.data.request.status).toBe('pending');
  const requestId=submitted.data.request.requestId;
  const pendingBalance=await api(corp,ct,'/api/my-accounts');
  expect(BigInt(pendingBalance.data.accounts.find(a=>a.id===account.id).availableSatang)).toBe(before);
  const queue=await api(owner,ot,'/api/qa/finance/topup/pending?stationId='+station);
  expect(queue.status).toBe(200);
  expect(queue.data.requests.some(x=>x.requestId===requestId)).toBe(true);
  const approved=await api(owner,ot,'/api/qa/finance/topup/review','POST',{requestId,approved:true});
  expect(approved.status,JSON.stringify(approved.data)).toBe(200);
  expect(approved.data.result.status).toBe('approved');
  expect(approved.data.result.simulated).toBe(true);
  const replay=await api(owner,ot,'/api/qa/finance/topup/review','POST',{requestId,approved:true});
  expect(replay.status).toBe(200);
  expect(replay.data.result.replayed).toBe(true);
  const after=await api(corp,ct,'/api/my-accounts');
  const funded=BigInt(after.data.accounts.find(a=>a.id===account.id).availableSatang);
  expect(funded).toBe(before+10000n);
  const issue=await api(corp,ct,'/api/coupons','POST',{
    accountId:account.id,stationFuelId:firstFuel.id,amountSatang:'5000',
    driverId:assigned.driverId,
    expiresAt:new Date(Date.now()+24*3600*1000).toISOString(),
  },{'idempotency-key':randomUUID().replaceAll('-','')});
  expect(issue.status,JSON.stringify(issue.data)).toBe(201);
  expect(issue.data.coupon.qrPayload).toBeTruthy();
  const reserved=await api(corp,ct,'/api/my-accounts');
  expect(BigInt(reserved.data.accounts.find(a=>a.id===account.id).availableSatang)).toBe(funded-5000n);
  const driverWallet=await api(driver,dt,'/api/driver/coupons');
  expect(driverWallet.status).toBe(200);
  expect(driverWallet.data.vehicles.some(v=>v.plate===assigned.plate)).toBe(true);
  expect(driverWallet.data.coupons.some(v=>v.qrPayload===issue.data.coupon.qrPayload)).toBe(true);
  const scan=await api(owner,ot,'/api/station/scan-qr','POST',
   {qrPayload:issue.data.coupon.qrPayload});
  expect(scan.status,JSON.stringify(scan.data)).toBe(200);
  expect(scan.data.coupon.stationName).toBe('QA-S01-A');
  await driver.locator('[data-ws-go="driver"]:visible').first().click();
  await expect(driver.locator('#driver-workspace canvas')).toBeVisible({timeout:15000});
  console.log('QA-FIN-01 PASSED synthetic 100 THB funding, 50 THB reserve, driver QR and pump scan; no real money/fueling');
 }finally{await Promise.all([corp.close(),owner.close(),driver.close()]);}
});
