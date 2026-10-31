import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',sales:'sales01',companies:[
  '4e6a3fc9-217d-4543-885b-113f1f3ba4c3','7f3dae09-5ff4-409c-bdf8-049086f99b7a','ff5796e7-e567-4790-aec6-0d5101fcd884']},
 {code:'s01b',sales:'sales01',companies:[
  'ab0a1f24-9a15-4a00-9da8-0a09397e4b24','4b19a8db-6b66-4707-8c5e-46648adbbe31','86bec094-71b8-4d9c-bea8-fdeed7c2ca66']},
 {code:'s02a',sales:'sales02',companies:[
  '9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6','963161ff-078a-4176-8762-47daf1075d20','c55f48a5-76b2-478f-97ea-727f03ed2a9d']},
 {code:'s02b',sales:'sales02',companies:[
  '9da2618b-151c-45df-aad6-16519ec76535','9b6da1cc-946f-4756-8e0e-8ce020ca6209','88a9d686-e2c3-4cef-8a2a-1a888354a4c7']},
];
const companies=stations.flatMap((s,i)=>s.companies.map((id,j)=>({
 id,station:s,alias:'c'+String(i*3+j+1).padStart(2,'0'),
 plate:'QA '+String(1001+i*3+j),
})));
function required(k){const v=process.env[k];if(!v)throw Error('Missing protected QA secret '+k);return v;}
function ownerPassword(s){
 return createHmac('sha256',required('OILSTATION_QA_'+s.sales.toUpperCase()+'_PASSWORD'))
  .update('OilStation QA station role account 20261031/v1/'+s.code+'-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
function password(s,alias){
 return createHmac('sha256',ownerPassword(s))
  .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,alias,secret,role,companyId){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:45000});
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(secret);
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const a=JSON.parse(localStorage.getItem(k));if(a?.access_token)return a.access_token;}catch{}
  }
  return null;
 });
 expect(token,'QA Supabase browser token').toBeTruthy();
 const res=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(res.status()).toBe(200);
 const ms=(await res.json()).memberships;
 expect(ms).toHaveLength(1);
 expect(ms[0].role).toBe(role);
 expect(ms[0].corporateCompanyId).toBe(companyId);
 return token;
}
async function call(page,token,path,body){
 const r=await page.request.fetch(BASE+path,{method:body?'POST':'GET',headers:{
  authorization:'Bearer '+token,...(body?{origin:BASE,'content-type':'application/json'}:{})},
  ...(body?{data:body}:{})});
 return {status:r.status(),data:await r.json().catch(()=>({}))};
}
test('Each of 12 Corporate Admins assigns own QA driver + car on real web, never Sales @qa-driver-assignment',async({browser},info)=>{
 test.setTimeout(24*60*1000);
 test.skip(process.env.OILSTATION_QA_DRIVER_ASSIGNMENT_RUN!=='true',
  'Only protected main-only run for the 12 fictional QA Corporate companies');
 required('OILSTATION_QA_SALES01_PASSWORD');required('OILSTATION_QA_SALES02_PASSWORD');
 required('OILSTATION_QA_EVIDENCE_PASSPHRASE');
 const beforeConfig=await browser.newPage();
 const config=await (await beforeConfig.request.get(BASE+'/api/public-config')).json();
 await beforeConfig.close();
 expect(config.qaFinanceSimEnabled).toBe(false);
 for(const c of companies){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await ctx.newPage();
   const token=await login(page,c.alias+'-admin',password(c.station,c.alias+'-admin'),
    'corporate_admin',c.id);
   const other=companies.find(x=>x.id!==c.id);
   const ownDrivers=await call(page,token,'/api/corporate/drivers?companyId='+c.id);
   expect(ownDrivers.status).toBe(200);
   const driver=(ownDrivers.data.drivers||[]).find(d=>d.userId);
   expect(driver,'driver must exist in company '+c.alias).toBeTruthy();
   expect(ownDrivers.data.drivers).toHaveLength(1);
   const forbiddenRoster=await call(page,token,'/api/corporate/drivers?companyId='+other.id);
   expect(forbiddenRoster.status).toBe(403);
   const wrongAssign=await call(page,token,'/api/corporate/driver-vehicle',{
    companyId:other.id,driverUserId:driver.userId,plate:c.plate,
   });
   expect(wrongAssign.status).toBe(403);
   await page.locator('[data-ws-go="corporate"]:visible').first().click();
   await expect(page.locator('#company-driver-workspace')).toBeAttached();
   await expect(page.locator('#company-driver-workspace select')).toHaveCount(1);
   const driverTab=page.locator('[data-context-for="corporate"] [data-os-pane-key="driver"]');
   await expect(driverTab).toBeVisible({timeout:30000});
   await driverTab.click();
   const driverHost=page.locator('#company-driver-workspace');
   await expect(driverHost).toBeVisible();
   await expect(driverHost.locator('select')).toHaveValue(driver.userId,{timeout:15000});
   await driverHost.locator('input').fill(c.plate);
   const response=page.waitForResponse(x=>x.url().endsWith('/api/corporate/driver-vehicle')&&
    x.request().method()==='POST');
   await driverHost.getByRole('button',{name:'ผูกทะเบียนกับคนขับ'}).click();
   const saved=await response;expect(saved.status(),c.alias+' assignment request').toBe(200);
   const assignment=(await saved.json()).assignment;
   expect(assignment.plate).toBe(c.plate);
   await expect(driverHost.getByText('บันทึกรถและทะเบียนให้คนขับแล้ว พร้อมออก QR')).toBeVisible();
   const roster=await call(page,token,'/api/corporate/drivers?companyId='+c.id);
   expect(roster.status).toBe(200);
   expect(roster.data.drivers).toHaveLength(1);
   expect(roster.data.drivers[0].plate).toBe(c.plate);
   expect(roster.data.drivers[0].vehicleId).toBe(assignment.vehicleId);
   // Company account visibility is read-only, and QA topup / QR issuance
   // are still refused until the separate synthetic-finance gate is enabled.
   const account=await call(page,token,'/api/my-accounts');
   expect(account.status).toBe(200);
   expect((account.data.accounts||[]).some(a=>a.companyId===c.id)).toBe(true);
   const denied=await call(page,token,'/api/qa/finance/topup/request',{
    accountId:account.data.accounts[0].id,amountSatang:'10000',
    requestKey:'77777777-7777-4777-8777-777777777777'});
   expect(denied.status).toBe(404);
   await page.screenshot({path:info.outputPath(c.alias+'-driver-vehicle-mobile.png'),
    animations:'disabled'});
   const driverCtx=await browser.newContext({viewport:{width:390,height:844}});
   try{
    const driverPage=await driverCtx.newPage();
    const dt=await login(driverPage,c.alias+'-driver',
      password(c.station,c.alias+'-driver'),'driver',c.id);
    const inbox=await call(driverPage,dt,'/api/driver/coupons');
    expect(inbox.status).toBe(200);
    expect(inbox.data.vehicles).toHaveLength(1);
    expect(inbox.data.vehicles[0].plate).toBe(c.plate);
    expect(inbox.data.coupons).toEqual([]);
    const otherDrivers=await call(driverPage,dt,'/api/corporate/drivers?companyId='+c.id);
    expect(otherDrivers.status).toBe(403);
    await driverPage.locator('[data-ws-go="driver"]:visible').first().click();
    await expect(driverPage.locator('#driver-workspace')).toBeVisible();
    await expect(driverPage.locator('#driver-workspace')).toContainText(c.plate,{timeout:15000});
    await driverPage.screenshot({path:info.outputPath(c.alias+'-driver-inbox-mobile.png'),
      animations:'disabled'});
   }finally{await driverCtx.close();}
  }finally{await ctx.close();}
 }
});
