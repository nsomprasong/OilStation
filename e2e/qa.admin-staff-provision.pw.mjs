import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const BASE='https://oilstation.goldensoft.cloud';
const DB='https://cxihsotcpdnalswfoysx.supabase.co';
const RUN='QA-20261031-PLATFORM-001';
const stations=[
 {code:'s01a',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',
  companies:['4e6a3fc9-217d-4543-885b-113f1f3ba4c3','7f3dae09-5ff4-409c-bdf8-049086f99b7a',
   'ff5796e7-e567-4790-aec6-0d5101fcd884']},
 {code:'s01b',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',
  companies:['ab0a1f24-9a15-4a00-9da8-0a09397e4b24','4b19a8db-6b66-4707-8c5e-46648adbbe31',
   '86bec094-71b8-4d9c-bea8-fdeed7c2ca66']},
 {code:'s02a',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',
  companies:['9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6','963161ff-078a-4176-8762-47daf1075d20',
   'c55f48a5-76b2-478f-97ea-727f03ed2a9d']},
 {code:'s02b',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205',
  companies:['9da2618b-151c-45df-aad6-16519ec76535','9b6da1cc-946f-4756-8e0e-8ce020ca6209',
   '88a9d686-e2c3-4cef-8a2a-1a888354a4c7']},
];
const roles=[['corporate_admin','admin'],['coupon_issuer','issuer'],
 ['accountant','accountant'],['finance_manager','finance'],['driver','driver']];
const targets=stations.flatMap((s,i)=>s.companies.map((id,j)=>{
 const prefix='c'+String(i*3+j+1).padStart(2,'0');
 return {station:s,id,prefix};
}));
function required(name){const s=process.env[name];if(!s)throw Error('Missing protected QA secret '+name);return s;}
function ownerPassword(s){
 return createHmac('sha256',required('OILSTATION_QA_'+s.sales.toUpperCase()+'_PASSWORD'))
  .update('OilStation QA station role account 20261031/v1/'+s.code+'-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
function password(s,alias){
 // Distinct employee secrets are derived inside the protected runner from the
 // own station owner's credential, NEVER by logging in as Sales to add staff.
 return createHmac('sha256',ownerPassword(s))
  .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function inventory(){
 const client=createClient(DB,required('OILSTATION_QA_DB_KEY'),
  {auth:{autoRefreshToken:false,persistSession:false}});
 const found=new Map();
 for(let page=1;page<=10;page++){
  const {data,error}=await client.auth.admin.listUsers({page,perPage:100});
  if(error)throw Error('QA Auth inventory unavailable; no mutation');
  const users=data?.users||[];
  for(const u of users){
   if(!u.email?.startsWith('qa-c')||!u.email.endsWith('@qa.oilstation.invalid'))continue;
   if(u.app_metadata?.oilstation_qa!==true||
      u.app_metadata?.oilstation_qa_run_id!==RUN)
    throw Error('Foreign QA run identity detected; refuse to modify');
   found.set(u.email,u.id);
  }
  if(users.length<100)break;
 }
 return found;
}
async function login(page,alias,secret,expectedRole,scopeField,scopeId){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:60000});
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(secret);
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{return JSON.parse(localStorage.getItem(k)).access_token;}catch{}
  }
  return null;
 });
 expect(token,alias+' Auth session').toBeTruthy();
 const r=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(r.status(),alias+' /api/me').toBe(200);
 const members=(await r.json()).memberships;
 expect(members,alias+' must have only own role').toHaveLength(1);
 expect(members[0].role).toBe(expectedRole);
 expect(members[0][scopeField]).toBe(scopeId);
 return token;
}
async function submit(page,entry,pass){
 await page.locator('#qa-create-scope-type').selectOption(entry.scopeType);
 await page.locator('#qa-create-role').selectOption(entry.roleCode);
 await page.locator('#qa-create-scope').selectOption(entry.scopeId);
 await expect(page.locator('#qa-create-username')).toHaveValue(entry.alias);
 await page.locator('#qa-create-password').fill(pass);
 const response=page.waitForResponse(x=>x.url().endsWith('/api/qa/accounts')&&
   x.request().method()==='POST');
 await page.locator('.os-qa-form button[type=submit]').click();
 const r=await response;expect(r.status(),entry.alias).toBe(201);
 const data=await r.json();
 expect(data.account.alias).toBe(entry.alias);
 await expect(page.locator('.os-qa-status')).toContainText('สร้างบัญชี '+entry.alias+' สำเร็จ');
}
test('Only own Station Admin bootstraps company Admin; own company Admin adds four personnel @qa-own-admin-staff',
 async({browser},info)=>{
 test.setTimeout(30*60*1000);
 test.skip(process.env.OILSTATION_QA_ADMIN_STAFF_RUN!=='true',
  'Run only in protected QA environment after database migration and main deploy');
 required('OILSTATION_QA_SALES01_PASSWORD');
 required('OILSTATION_QA_SALES02_PASSWORD');
 required('OILSTATION_QA_DB_KEY');
 required('OILSTATION_QA_EVIDENCE_PASSPHRASE');
 const before=await inventory();
 const aliases=targets.flatMap(t=>roles.map(([,s])=>t.prefix+'-'+s));
 expect(aliases).toHaveLength(60);
 for(const email of before.keys()){
  if(email.startsWith('qa-c')&&!aliases.some(a=>email==='qa-'+a+'@qa.oilstation.invalid'))
   throw Error('Unknown synthetic Corporate QA identity; stop');
 }
 // Phase 1: four station OWNERS bootstrap their own 3 corporate admins through
 // their real browser form. Never authenticate as Sales to create personnel.
 for(const station of stations){
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  try{
   const page=await context.newPage();
   const token=await login(page,station.code+'-owner',ownerPassword(station),
     'station_owner','stationId',station.id);
   const scoped=await page.request.get(BASE+'/api/qa/scopes',
     {headers:{authorization:'Bearer '+token}});
   expect(scoped.status()).toBe(200);
   const own=(await scoped.json()).scopes;
   expect(own.station.map(x=>x.id)).toEqual([station.id]);
   const local=targets.filter(t=>t.station===station);
   expect(own.corporate_company.map(x=>x.id).sort()).toEqual(
     local.filter(t=>!before.has('qa-'+t.prefix+'-admin@qa.oilstation.invalid'))
      .map(x=>x.id).sort());
   const foreign=targets.find(t=>t.station!==station);
   const deny=await page.request.post(BASE+'/api/qa/accounts',{
    headers:{authorization:'Bearer '+token,origin:BASE},
    data:{alias:foreign.prefix+'-admin',roleCode:'corporate_admin',
     scopeType:'corporate_company',scopeId:foreign.id,
     password:password(foreign.station,foreign.prefix+'-admin')}});
   expect(deny.status()).toBe(403);
   await page.locator('[data-ws-go="invitations"]:visible').first().click();
   await expect(page.locator('#qa-create-scope-type')).toBeVisible();
   for(const c of local){
    const alias=c.prefix+'-admin';
    if(before.has('qa-'+alias+'@qa.oilstation.invalid'))continue;
    await submit(page,{scopeType:'corporate_company',scopeId:c.id,
      roleCode:'corporate_admin',alias},password(station,alias));
   }
   await page.screenshot({path:info.outputPath('station-owner-'+station.code+'.png'),
     animations:'disabled'});
  }finally{await context.close();}
 }
 const afterOwners=await inventory();
 expect(targets.filter(x=>afterOwners.has('qa-'+x.prefix+'-admin@qa.oilstation.invalid'))).toHaveLength(12);
 // Phase 2: EACH of 12 Corporate Admins signs in independently and creates
 // ONLY its own staff. The Admin, not Sales or the station owner, is audit actor.
 for(const c of targets){
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  try{
   const page=await context.newPage();
   const alias=c.prefix+'-admin';
   const token=await login(page,alias,password(c.station,alias),
     'corporate_admin','corporateCompanyId',c.id);
   const scoped=await page.request.get(BASE+'/api/qa/scopes',
    {headers:{authorization:'Bearer '+token}});
   expect(scoped.status()).toBe(200);
   const own=(await scoped.json()).scopes;
   expect(own.corporate_company.map(x=>x.id)).toEqual([c.id]);
   expect(own.station).toEqual([]);
   const foreign=targets.find(t=>t.id!==c.id);
   const denial=await page.request.post(BASE+'/api/qa/accounts',{
     headers:{authorization:'Bearer '+token,origin:BASE},
     data:{alias:foreign.prefix+'-driver',password:password(foreign.station,foreign.prefix+'-driver'),
      roleCode:'driver',scopeType:'corporate_company',scopeId:foreign.id}});
   expect(denial.status()).toBe(403);
   await page.locator('[data-ws-go="invitations"]:visible').first().click();
   await expect(page.locator('#qa-create-scope-type')).toBeVisible();
   for(const [roleCode,suffix] of roles.slice(1)){
    const staff=c.prefix+'-'+suffix;
    if(before.has('qa-'+staff+'@qa.oilstation.invalid'))continue;
    await submit(page,{scopeType:'corporate_company',scopeId:c.id,
      roleCode,alias:staff},password(c.station,staff));
   }
   await page.screenshot({path:info.outputPath('company-admin-'+c.prefix+'.png'),
     animations:'disabled'});
  }finally{await context.close();}
 }
 const after=await inventory();
 for(const alias of aliases)expect(after.has('qa-'+alias+'@qa.oilstation.invalid'),
   'missing real QA Auth: '+alias).toBe(true);
 expect(new Set(aliases.map(a=>after.get('qa-'+a+'@qa.oilstation.invalid'))).size).toBe(60);
 // Authenticate each 48 actual staff role; membership/menus must be scoped.
 for(const c of targets){
  for(const [roleCode,suffix] of roles.slice(1)){
   const alias=c.prefix+'-'+suffix;
   const context=await browser.newContext({viewport:{width:390,height:844}});
   try{
    const page=await context.newPage();
    await login(page,alias,password(c.station,alias),
      roleCode,'corporateCompanyId',c.id);
    if(roleCode==='driver'){
      await expect(page.locator('[data-ws-go="driver"]:visible').first()).toBeVisible();
      await expect(page.locator('[data-ws-go="corporate"]')).toHaveCount(0);
    }
    await expect(page.locator('[data-ws-go="stations"]')).toHaveCount(0);
   }finally{await context.close();}
  }
 }
});
