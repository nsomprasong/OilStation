import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// Protected, read-only QA on MAIN ONLY. Never upload traces or screenshots
// with authenticated Supabase JWTs. Never call a mutation endpoint.
const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',companies:[
   '4e6a3fc9-217d-4543-885b-113f1f3ba4c3',
   '7f3dae09-5ff4-409c-bdf8-049086f99b7a',
   'ff5796e7-e567-4790-aec6-0d5101fcd884']},
 {code:'s01b',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',companies:[
   'ab0a1f24-9a15-4a00-9da8-0a09397e4b24',
   '4b19a8db-6b66-4707-8c5e-46648adbbe31',
   '86bec094-71b8-4d9c-bea8-fdeed7c2ca66']},
 {code:'s02a',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',companies:[
   '9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6',
   '963161ff-078a-4176-8762-47daf1075d20',
   'c55f48a5-76b2-478f-97ea-727f03ed2a9d']},
 {code:'s02b',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205',companies:[
   '9da2618b-151c-45df-aad6-16519ec76535',
   '9b6da1cc-946f-4756-8e0e-8ce020ca6209',
   '88a9d686-e2c3-4cef-8a2a-1a888354a4c7']},
];
const companies=stations.flatMap((station,i)=>station.companies.map((id,j)=>({
 id,station,prefix:'c'+String(i*3+j+1).padStart(2,'0'),
})));
function required(name){const val=process.env[name];if(!val)throw Error('Missing protected secret name: '+name);return val;}
function ownerPassword(station){
 return createHmac('sha256',required('OILSTATION_QA_'+station.sales.toUpperCase()+'_PASSWORD'))
  .update('OilStation QA station role account 20261031/v1/'+station.code+'-owner')
  .digest('base64url').slice(0,30)+'a9!';
}
function staffPassword(company,suffix){
 return createHmac('sha256',ownerPassword(company.station))
  .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+company.prefix+'-'+suffix)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,alias,password,role,scopeId,scopeField){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:40_000});
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(password);
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:35_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const session=JSON.parse(localStorage.getItem(key));
     if(typeof session?.access_token==='string')return session.access_token;
   }catch{}
  }return null;
 });
 expect(token,'authenticated browser session').toBeTruthy();
 const res=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(res.status(),alias+' /api/me').toBe(200);
 const body=await res.json();
 expect(body.memberships,alias+' single QA scope').toHaveLength(1);
 expect(body.memberships[0].role,alias+' server role').toBe(role);
 if(scopeField)expect(body.memberships[0][scopeField],alias+' tenant scope').toBe(scopeId);
 return token;
}
async function get(page,token,path){return page.request.get(BASE+path,{headers:{authorization:'Bearer '+token}});}
async function withIdentity(browser,fn){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{return await fn(await context.newPage());}finally{await context.close();}
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_ROLE_READONLY_RUN!=='true',
  'Only protected main-only GitHub Actions QA may load the fixed-role credentials.');
 required('OILSTATION_QA_SALES01_PASSWORD');
 required('OILSTATION_QA_SALES02_PASSWORD');
});
test('R-00 QA release has simulation finance off @qa-role-readonly',async({request})=>{
 const response=await request.get(BASE+'/api/public-config');
 expect(response.status()).toBe(200);
 const config=await response.json();
 expect(config.qaFinanceSimEnabled).toBe(false);
});
test('R-01 both Sales accounts see only their two stations @qa-role-readonly',async({browser})=>{
 test.setTimeout(4*60*1000);
 for(const alias of ['sales01','sales02']){
  await withIdentity(browser,async page=>{
   const token=await login(page,alias,required('OILSTATION_QA_'+alias.toUpperCase()+'_PASSWORD'),'platform_sales',null,null);
   await expect(page.locator('[data-ws-go="stations"]:visible').first()).toBeVisible();
   const response=await get(page,token,'/api/platform/sales/stations');
   expect(response.status()).toBe(200);
   const list=(await response.json()).stations||[];
   expect(list.map(s=>s.stationName).sort()).toEqual(stations.filter(s=>s.sales===alias)
    .map(s=>'QA-'+s.code.toUpperCase().replace(/^S0([12])([AB])$/,'S$1-$2')).sort());
   const noPersonnel=await get(page,token,'/api/qa/scopes');
   expect(noPersonnel.status()).toBe(403);
  });
  console.log('Read-only Sales PASS: '+alias);
 }
});
test('R-02 four station owners have exactly their station scope and private menu @qa-role-readonly',async({browser})=>{
 test.setTimeout(7*60*1000);
 for(const station of stations){
  await withIdentity(browser,async page=>{
   const token=await login(page,station.code+'-owner',ownerPassword(station),'station_owner',station.id,'stationId');
   await expect(page.locator('[data-ws-go="fuel"]:visible').first()).toBeVisible();
   await expect(page.locator('[data-ws-go="invitations"]:visible').first()).toBeVisible();
   const scopes=await get(page,token,'/api/qa/scopes');
   expect(scopes.status()).toBe(200);
   const data=await scopes.json();
   expect(data.scopes.station.map(s=>s.id)).toEqual([station.id]);
   await expect(page.locator('[data-ws-go="sales"]')).toHaveCount(0);
  });
  console.log('Read-only Station Owner PASS: '+station.code);
 }
});
test('R-03 twelve Corporate Admins can see own company/driver but not other tenant @qa-role-readonly',async({browser})=>{
 test.setTimeout(12*60*1000);
 for(const company of companies){
  await withIdentity(browser,async page=>{
   const token=await login(page,company.prefix+'-admin',staffPassword(company,'admin'),
    'corporate_admin',company.id,'corporateCompanyId');
   await expect(page.locator('[data-ws-go="corporate"]:visible').first()).toBeVisible();
   const own=await get(page,token,'/api/corporate/drivers?companyId='+company.id);
   expect(own.status()).toBe(200);
   expect((await own.json()).drivers).toHaveLength(1);
   const other=companies.find(c=>c.id!==company.id);
   const denied=await get(page,token,'/api/corporate/drivers?companyId='+other.id);
   expect(denied.status()).toBe(403);
   await expect(page.locator('[data-ws-go="stations"]')).toHaveCount(0);
  });
  console.log('Read-only Corporate Admin PASS: '+company.prefix);
 }
});
test('R-04 twelve issuers may read own drivers, not manage station @qa-role-readonly',async({browser})=>{
 test.setTimeout(12*60*1000);
 for(const company of companies){
  await withIdentity(browser,async page=>{
   const token=await login(page,company.prefix+'-issuer',staffPassword(company,'issuer'),
    'coupon_issuer',company.id,'corporateCompanyId');
   await expect(page.locator('[data-ws-go="corporate"]:visible').first()).toBeVisible();
   const own=await get(page,token,'/api/corporate/drivers?companyId='+company.id);
   expect(own.status()).toBe(200);
   const foreign=companies.find(c=>c.id!==company.id);
   const denied=await get(page,token,'/api/corporate/drivers?companyId='+foreign.id);
   expect(denied.status()).toBe(403);
   await expect(page.locator('[data-ws-go="stations"]')).toHaveCount(0);
  });
  console.log('Read-only Corporate Issuer PASS: '+company.prefix);
 }
});
test('R-05 twelve accountants and twelve finance managers cannot see driver roster @qa-role-readonly',async({browser})=>{
 test.setTimeout(18*60*1000);
 for(const suffix of ['accountant','finance']){
  const role=suffix==='finance'?'finance_manager':'accountant';
  for(const company of companies){
   await withIdentity(browser,async page=>{
    const token=await login(page,company.prefix+'-'+suffix,staffPassword(company,suffix),
     role,company.id,'corporateCompanyId');
    await expect(page.locator('[data-ws-go="corporate"]:visible').first()).toBeVisible();
    const denied=await get(page,token,'/api/corporate/drivers?companyId='+company.id);
    expect(denied.status()).toBe(403);
    await expect(page.locator('[data-ws-go="stations"]')).toHaveCount(0);
   });
   console.log('Read-only Corporate '+suffix+' PASS: '+company.prefix);
  }
 }
});
test('R-06 twelve drivers read own vehicle/QR inbox but cannot manage company @qa-role-readonly',async({browser})=>{
 test.setTimeout(12*60*1000);
 for(const company of companies){
  await withIdentity(browser,async page=>{
   const token=await login(page,company.prefix+'-driver',staffPassword(company,'driver'),
    'driver',company.id,'corporateCompanyId');
   await expect(page.locator('[data-ws-go="driver"]:visible').first()).toBeVisible();
   await expect(page.locator('[data-ws-go="corporate"]')).toHaveCount(0);
   const inbox=await get(page,token,'/api/driver/coupons');
   expect(inbox.status()).toBe(200);
   const payload=await inbox.json();
   expect(payload.vehicles).toHaveLength(1);
   expect(Array.isArray(payload.coupons)).toBe(true);
   const denied=await get(page,token,'/api/corporate/drivers?companyId='+company.id);
   expect(denied.status()).toBe(403);
  });
  console.log('Read-only Driver PASS: '+company.prefix);
 }
});