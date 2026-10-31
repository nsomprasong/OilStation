import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

const BASE='https://oilstation.goldensoft.cloud';
const DB='https://cxihsotcpdnalswfoysx.supabase.co';
const RUN='QA-20261031-PLATFORM-001';
const stations=[
 {code:'s01a',name:'QA-S01-A',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9'},
 {code:'s01b',name:'QA-S01-B',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'},
 {code:'s02a',name:'QA-S02-A',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be'},
 {code:'s02b',name:'QA-S02-B',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205'}
];
const expected=stations.flatMap((s,i)=>[1,2,3].map(n=>({
 station:s,name:s.name+'-C0'+n,
 email:'qa-c'+String(i*3+n).padStart(2,'0')+'-admin@qa.oilstation.invalid'
})));
function secret(k){const v=process.env[k];if(!v)throw Error('Missing protected QA secret '+k);return v;}
function ownerPassword(s){
 return createHmac('sha256',secret('OILSTATION_QA_'+s.sales.toUpperCase()+'_PASSWORD'))
  .update('OilStation QA station role account 20261031/v1/'+s.code+'-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
function dbHeaders(){
 const key=secret('OILSTATION_QA_DB_KEY');
 return {apikey:key,'content-type':'application/json',...(key.startsWith('sb_secret_')?{}:{authorization:'Bearer '+key})};
}
async function rpc(name,body){
 const r=await fetch(DB+'/rest/v1/rpc/'+name,{
  method:'POST',headers:dbHeaders(),body:JSON.stringify(body)});
 if(!r.ok)throw Error(name+' evidence unavailable HTTP '+r.status);
 return r.json();
}
async function evidence(){
 return Promise.all([
  rpc('oilstation_qa_platform_evidence',{p_qa_run_id:RUN}),
  rpc('oilstation_qa_company_evidence',{
   p_qa_run_id:RUN,p_station_ids:stations.map(x=>x.id)})
 ]);
}
async function login(page,s){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(s.code+'-owner');
 await page.locator('#qa-login-password').fill(ownerPassword(s));
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-go="customers"]:visible').first()).toBeVisible();
 return page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const v=JSON.parse(localStorage.getItem(k));if(v?.access_token)return v.access_token;}catch{}
  }
  return null;
 });
}
test('Station Owner creates 12 idempotent zero-balance QA companies, denies cross station @qa-companies',
 async ({browser},info)=>{
 test.setTimeout(10*60*1000);
 test.skip(process.env.OILSTATION_QA_COMPANIES_RUN!=='true',
  'Only owner-approved production-preview protected QA fixture run');
 const [before,companyBefore]=await evidence();
 expect(before.stations.map(s=>s.name).sort()).toEqual(stations.map(s=>s.name).sort());
 expect(before.allStationsCount).toBe(5);
 expect(before.protectedStationCount).toBe(1);
 expect(companyBefore.companyCount).toBeLessThanOrEqual(12);
 for(const s of stations){
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  try{
   const page=await context.newPage();
   const token=await login(page,s);
   expect(token,'valid QA station-owner session').toBeTruthy();
   const who=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
   expect(who.status()).toBe(200);
   const members=(await who.json()).memberships;
   expect(members).toHaveLength(1);
   expect(members[0].role).toBe('station_owner');
   expect(members[0].stationId).toBe(s.id);
   const other=stations.find(x=>x.id!==s.id);
   const cross=await page.request.post(BASE+'/api/station/customers',{
    headers:{authorization:'Bearer '+token,origin:BASE},
    data:{stationId:other.id,name:other.name+'-C01',taxId:null,
     contactEmail:'qa-c04-admin@qa.oilstation.invalid',
     paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null}});
   expect(cross.status()).toBe(403);
   const wrongName=await page.request.post(BASE+'/api/station/customers',{
    headers:{authorization:'Bearer '+token,origin:BASE},
    data:{stationId:s.id,name:'REAL_CUSTOMER',taxId:null,
     contactEmail:'real@company.example',paymentTermsDays:30,
     dueMode:'per_fill',statementCloseDay:null}});
   expect(wrongName.status()).toBe(400);
   await page.locator('[data-ws-go="customers"]:visible').first().click();
   await expect(page.locator('#customer-create')).toBeVisible();
   for(const fixture of expected.filter(x=>x.station.id===s.id)){
    await page.locator('#customer-name').fill(fixture.name);
    await page.locator('#customer-email').fill(fixture.email);
    await page.locator('#customer-tax').fill('');
    await page.locator('#customer-terms').fill('0');
    await page.locator('#customer-due').selectOption('per_fill');
    await page.locator('#customer-create-btn').click();
    await expect(page.locator('#customer-invite-status')).toContainText(fixture.name,
      {timeout:20000});
    await expect(page.locator('#customer-notice')).toContainText('เปิดบัญชีบริษัทเรียบร้อย');
   }
   await page.screenshot({path:info.outputPath('corporate-'+s.code+'-desktop.png'),
      animations:'disabled'});
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('#customer-create')).toBeVisible();
   await page.screenshot({path:info.outputPath('corporate-'+s.code+'-mobile.png'),
      animations:'disabled'});
  }finally{await context.close();}
 }
 const [after,companyAfter]=await evidence();
 expect(companyAfter.companyCount).toBe(12);
 expect(companyAfter.companies).toHaveLength(12);
 expect(companyAfter.companies.map(c=>c.name).sort()).toEqual(expected.map(c=>c.name).sort());
 for(const x of companyAfter.companies){
  const fixture=expected.find(f=>f.name===x.name);
  expect(x.stationId).toBe(fixture.station.id);
  expect(x.email).toBe(fixture.email);
  for(const field of ['prepaid','credit','debt','reserved'])expect(x[field]).toBe('0');
  expect(x.terms).toBe(0);
 }
 // New Corporate customers may increase company count only. Station/creator
 // ownership, QA actor roles, and four creation audits must never change.
 for(const key of ['stations','users','assignments','requests','audit'])
  expect(after[key],key+' changed during Corporate fixture run').toEqual(before[key]);
 expect(after.allStationsCount).toBe(5);
 expect(after.protectedStationCount).toBe(1);
 expect(after.companiesCount).toBe(12);
});
