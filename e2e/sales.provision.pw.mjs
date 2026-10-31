import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const BASE='https://oilstation.goldensoft.cloud';
const DB='https://cxihsotcpdnalswfoysx.supabase.co';
const RUN='QA-20261031-PLATFORM-001';
const stations=[
 {name:'QA-S01-A',code:'s01a',org:'o01',sales:'sales01',
  id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',orgId:'d6f31134-2c74-41d8-8bc3-6d83bb41840b'},
 {name:'QA-S01-B',code:'s01b',org:'o02',sales:'sales01',
  id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',orgId:'948d946d-aa98-4718-b246-991313371ddb'},
 {name:'QA-S02-A',code:'s02a',org:'o03',sales:'sales02',
  id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',orgId:'db30c758-533c-463c-a226-d49f032e960a'},
 {name:'QA-S02-B',code:'s02b',org:'o04',sales:'sales02',
  id:'02183a4e-47b0-4575-9f4f-74cec6553205',orgId:'e5cb8456-5611-421b-8265-229f6b1daa65'}
];
const orgRoles={organization_owner:'owner',billing_manager:'billing'};
const stationRoles={station_owner:'owner',manager:'manager',cashier:'cashier',
 attendant:'attendant',pump_staff:'pump',hr_manager:'hr',finance_manager:'finance'};
const roles=stations.flatMap(s=>[
 ...Object.entries(orgRoles).map(([roleCode,suffix])=>({
  sales:s.sales,scopeType:'organization',scopeId:s.orgId,roleCode,alias:s.org+'-'+suffix})),
 ...Object.entries(stationRoles).map(([roleCode,suffix])=>({
  sales:s.sales,scopeType:'station',scopeId:s.id,roleCode,alias:s.code+'-'+suffix})),
]);
function required(name){const v=process.env[name];if(!v)throw Error('missing protected QA secret '+name);return v;}
function derivePassword(sales,alias){
 // Unique, reproducible only inside trusted GitHub Environment. Never reuse
 // the Sales password directly and never write these derived values to logs.
 return createHmac('sha256',required('OILSTATION_QA_'+sales.toUpperCase()+'_PASSWORD'))
  .update('OilStation QA station role account 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function dbEvidence(){
 const key=required('OILSTATION_QA_DB_KEY');
 const headers={apikey:key,'content-type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.authorization='Bearer '+key;
 const response=await fetch(DB+'/rest/v1/rpc/oilstation_qa_platform_evidence',{
  method:'POST',headers,body:JSON.stringify({p_qa_run_id:RUN})});
 if(!response.ok)throw Error('QA evidence RPC denied HTTP '+response.status);
 return response.json();
}
async function findExisting(){
 const client=createClient(DB,required('OILSTATION_QA_DB_KEY'),
  {auth:{autoRefreshToken:false,persistSession:false}});
 const result=new Map();
 for(let page=1;page<=10;page++){
  const {data,error}=await client.auth.admin.listUsers({page,perPage:100});
  if(error)throw Error('QA Auth inventory cannot be verified, cannot provision safely');
  for(const user of data?.users||[]){
   if(user.email?.startsWith('qa-')&&user.email.endsWith('@qa.oilstation.invalid')){
    if(user.app_metadata?.oilstation_qa!==true||
       user.app_metadata?.oilstation_qa_run_id!==RUN)
      throw Error('QA identity from another run found: stop without mutation');
    result.set(user.email,user.id);
   }
  }
  if((data?.users||[]).length<100)break;
 }
 return result;
}
async function login(page,alias,password){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(password);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible();
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const v=JSON.parse(localStorage.getItem(k));if(v?.access_token)return v.access_token;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 return token;
}
function headers(token){return {authorization:'Bearer '+token};}
test('Sales can create all 36 QA organization/station roles ONLY for its own 2 stations @sales-provision',async({browser},info)=>{
 test.setTimeout(14*60*1000);
 test.skip(process.env.OILSTATION_QA_SALES_PROVISION_RUN!=='true',
  'Only owner-gated Playwright on main with protected QA credentials');
 const before=await dbEvidence();
 expect(before.stations.map(s=>s.name).sort()).toEqual(stations.map(s=>s.name).sort());
 expect(before.allStationsCount).toBe(5);
 expect(before.protectedStationCount).toBe(1);
 expect(before.companiesCount).toBe(0);
 expect(before.requests).toHaveLength(4);
 expect(before.audit).toHaveLength(4);
 const preexisting=await findExisting();
 expect(preexisting.has('qa-support01@qa.oilstation.invalid')).toBe(false);
 for(const s of stations){
  if(preexisting.has('qa-'+s.code+'-not-a-role@qa.oilstation.invalid'))
   throw Error('unexpected QA role alias');
 }
 for(const sales of ['sales01','sales02']){
  const owned=stations.filter(s=>s.sales===sales);
  const other=stations.find(s=>s.sales!==sales);
  const context=await browser.newContext({viewport:{width:1280,height:860}});
  try{
   const page=await context.newPage();
   const token=await login(page,sales,required('OILSTATION_QA_'+sales.toUpperCase()+'_PASSWORD'));
   const me=await page.request.get(BASE+'/api/me',{headers:headers(token)});
   expect(me.status()).toBe(200);
   const member=(await me.json()).memberships;
   expect(member).toHaveLength(1);
   expect(member[0].role).toBe('platform_sales');
   const scopeResp=await page.request.get(BASE+'/api/qa/scopes',{headers:headers(token)});
   expect(scopeResp.status()).toBe(200);
   const allowed=(await scopeResp.json()).scopes;
   expect(allowed.station.map(x=>x.id).sort()).toEqual(owned.map(s=>s.id).sort());
   expect(allowed.organization.map(x=>x.id).sort()).toEqual(owned.map(s=>s.orgId).sort());
   expect(allowed.platform).toEqual([]);
   expect(allowed.corporate_company).toEqual([]);
   expect(allowed.station.map(x=>x.aliasPrefix).sort()).toEqual(owned.map(s=>s.code).sort());
   const crossRole={
    alias:other.code+'-manager',roleCode:'manager',scopeType:'station',scopeId:other.id,
    password:derivePassword(sales,other.code+'-manager')};
   const forbidden=await page.request.post(BASE+'/api/qa/accounts',{
    headers:{...headers(token),origin:BASE},data:crossRole});
   expect(forbidden.status()).toBe(403);
   const forbiddenInvite=await page.request.post(BASE+'/api/invitations/create',{
    headers:{...headers(token),origin:BASE},
    data:{email:'qa-cross-denied@qa.oilstation.invalid',roleCode:'station_owner',
      scopeType:'station',scopeId:other.id}
   });
   expect(forbiddenInvite.status()).toBe(403);
   await page.locator('[data-ws-go="stations"]:visible').first().click();
   await expect(page.locator('.os-station-card')).toHaveCount(2);
   await expect(page.locator('.os-station-card .invite-control')).toHaveCount(4);
   await page.screenshot({path:info.outputPath('delegation-'+sales+'-station-invites.png'),
    animations:'disabled'});
   await page.locator('[data-ws-go="invitations"]:visible').first().click();
   await expect(page.locator('#qa-create-scope-type')).toBeVisible();
   await expect(page.locator('#qa-create-scope option')).toHaveCount(2);
   for(const role of roles.filter(x=>x.sales===sales)){
    const email='qa-'+role.alias+'@qa.oilstation.invalid';
    if(preexisting.has(email))continue;
    await page.locator('#qa-create-scope-type').selectOption(role.scopeType);
    await page.locator('#qa-create-role').selectOption(role.roleCode);
    await page.locator('#qa-create-scope').selectOption(role.scopeId);
    await expect(page.locator('#qa-create-username')).toHaveValue(role.alias);
    await page.locator('#qa-create-password').fill(derivePassword(role.sales,role.alias));
    await page.locator('.os-qa-form button[type="submit"]').click();
    await expect(page.locator('.os-qa-status')).toContainText('สร้างบัญชี '+role.alias+' สำเร็จ',
     {timeout:35000});
   }
   await page.screenshot({path:info.outputPath('delegation-'+sales+'-roles-created.png'),
     animations:'disabled'});
  }finally{await context.close();}
 }
 const afterInventory=await findExisting();
 for(const role of roles){
  expect(afterInventory.has('qa-'+role.alias+'@qa.oilstation.invalid'),
    'QA role missing: '+role.alias).toBe(true);
 }
 // Every actual role identity can authenticate, and /api/me must show exactly
 // one membership with the UUID assigned by the role matrix.
 for(const role of roles){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   const token=await login(page,role.alias,derivePassword(role.sales,role.alias));
   const response=await page.request.get(BASE+'/api/me',{headers:headers(token)});
   expect(response.status(),role.alias).toBe(200);
   const ms=(await response.json()).memberships;
   expect(ms,role.alias).toHaveLength(1);
   expect(ms[0].scopeType,role.alias).toBe(role.scopeType);
   expect(ms[0].role,role.alias).toBe(role.roleCode);
   expect(role.scopeType==='station'?ms[0].stationId:ms[0].organizationId,
    role.alias).toBe(role.scopeId);
   if(role.roleCode==='finance_manager'){
    await expect(page.locator('[data-ws-go="finance"]:visible').first()).toBeVisible();
    await expect(page.locator('[data-ws-go="hr"]')).toHaveCount(0);
   }
   if(role.roleCode==='hr_manager'){
    await expect(page.locator('[data-ws-go="hr"]:visible').first()).toBeVisible();
    await expect(page.locator('[data-ws-go="reviews"]:visible').first()).toBeVisible();
   }
   if(role.roleCode==='billing_manager'){
    await expect(page.locator('[data-ws-go="billing"]:visible').first()).toBeVisible();
   }
  }finally{await context.close();}
 }
 const after=await dbEvidence();
 for(const key of ['stations','users','assignments','requests','audit'])
  expect(after[key],key+' must be unchanged').toEqual(before[key]);
 expect(after.allStationsCount).toBe(5);
 expect(after.protectedStationCount).toBe(1);
 expect(after.companiesCount).toBe(0);
});
