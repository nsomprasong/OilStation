import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// This suite exercises the ACTUAL deployed UI and authorized GETs in the
// owner's four existing fictional QA stations and twelve fictional companies.
// NO business write, no finance simulation, no real email or bank/Stripe action.
// Authenticated browser traces, screenshots and videos are intentionally off.
const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',org:'o01',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',orgId:'d6f31134-2c74-41d8-8bc3-6d83bb41840b',
  companies:['4e6a3fc9-217d-4543-885b-113f1f3ba4c3','7f3dae09-5ff4-409c-bdf8-049086f99b7a','ff5796e7-e567-4790-aec6-0d5101fcd884']},
 {code:'s01b',org:'o02',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',orgId:'948d946d-aa98-4718-b246-991313371ddb',
  companies:['ab0a1f24-9a15-4a00-9da8-0a09397e4b24','4b19a8db-6b66-4707-8c5e-46648adbbe31','86bec094-71b8-4d9c-bea8-fdeed7c2ca66']},
 {code:'s02a',org:'o03',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',orgId:'db30c758-533c-463c-a226-d49f032e960a',
  companies:['9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6','963161ff-078a-4176-8762-47daf1075d20','c55f48a5-76b2-478f-97ea-727f03ed2a9d']},
 {code:'s02b',org:'o04',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205',orgId:'e5cb8456-5611-421b-8265-229f6b1daa65',
  companies:['9da2618b-151c-45df-aad6-16519ec76535','9b6da1cc-946f-4756-8e0e-8ce020ca6209','88a9d686-e2c3-4cef-8a2a-1a888354a4c7']},
];
const companies=stations.flatMap((station,i)=>station.companies.map((id,j)=>({
  id,station,alias:'c'+String(i*3+j+1).padStart(2,'0')
})));
function password(station,alias){
 const secret=process.env['OILSTATION_QA_'+station.sales.toUpperCase()+'_PASSWORD'];
 if(!secret)throw Error('Protected QA Sales secret unavailable');
 if(alias===station.sales)return secret;
 if(alias.startsWith('c')){
  const owner=createHmac('sha256',secret)
   .update('OilStation QA station role account 20261031/v1/'+station.code+'-owner')
   .digest('base64url').slice(0,30)+'a9!';
  return createHmac('sha256',owner)
   .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+alias)
   .digest('base64url').slice(0,30)+'a9!';
 }
 return createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,station,alias,role,scopeId,scopeField){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:45000});
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(password(station,alias));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(key));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token,'signed-in QA session').toBeTruthy();
 const r=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(r.status(),alias+' /api/me').toBe(200);
 const ms=(await r.json()).memberships;
 expect(ms).toHaveLength(1);expect(ms[0].role).toBe(role);
 if(scopeField)expect(ms[0][scopeField]).toBe(scopeId);
 return token;
}
async function get(page,token,path){
 return page.request.get(BASE+path,{headers:{authorization:'Bearer '+token}});
}
async function visit(page,key){
 // Main modules appear on Home only; contextual tabs are functional submenus.
 const active=await page.locator('[data-workspace-shell]').getAttribute('data-active-screen');
 if(active&&active!=='overview'){
  await page.locator('[data-ws-go="overview"]:visible').first().click();
  await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
 }
 const link=page.locator('[data-ws-go="'+key+'"]:visible').first();
 await expect(link,'authorized module '+key).toBeVisible();
 await link.click();
 await expect(page.locator('[data-ws-screen="'+key+'"]:visible')).toBeVisible();
}
async function inBrowser(browser,fn){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{return await fn(await context.newPage());}finally{await context.close();}
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_FUNCTIONAL_READONLY_RUN!=='true',
  'Protected main-only UAT runner for fixed QA accounts');
 if(!process.env.OILSTATION_QA_SALES01_PASSWORD||!process.env.OILSTATION_QA_SALES02_PASSWORD)
  throw Error('Missing protected QA role credentials');
});
test('FUN-00 finance release remains disabled; no QR writes @qa-functional',async({request})=>{
 const r=await request.get(BASE+'/api/public-config');expect(r.status()).toBe(200);
 const cfg=await r.json();expect(cfg.qaFinanceSimEnabled).toBe(false);
});
test('FUN-01 Sales actual station directory and private reporting @qa-functional',async({browser})=>{
 test.setTimeout(5*60*1000);
 for(const alias of ['sales01','sales02']){
  await inBrowser(browser,async page=>{
   const station=stations.find(s=>s.sales===alias);
   const token=await login(page,station,alias,'platform_sales',null,null);
   await visit(page,'stations');
   await expect(page.locator('.os-station-card')).toHaveCount(2,{timeout:25000});
   const st=await get(page,token,'/api/platform/sales/stations');expect(st.status()).toBe(200);
   expect((await st.json()).stations).toHaveLength(2);
   await visit(page,'sales');
   await expect(page.locator('#platform-sales-workspace')).not.toBeEmpty();
   const dashboard=await get(page,token,'/api/platform/sales/workspace');
   expect(dashboard.status()).toBe(200);
  });
  console.log('FUN Sales station directory/report '+alias+' PASS');
 }
});
test('FUN-02 all four owners view actual fuel catalog and prices; edit UI only @qa-functional',async({browser})=>{
 test.setTimeout(8*60*1000);
 for(const station of stations){
  await inBrowser(browser,async page=>{
   const token=await login(page,station,station.code+'-owner','station_owner',station.id,'stationId');
   await visit(page,'fuel');
   const panel=page.locator('#station-fuel-workspace');
   await expect(panel.locator('.fuel-row').first()).toBeVisible({timeout:25000});
   const api=await get(page,token,'/api/station-fuels?stationId='+station.id);
   expect(api.status()).toBe(200);
   const fuels=(await api.json()).fuels||[];
   expect(fuels.filter(f=>f.enabled&&Number(f.publicPrice)>0).length).toBeGreaterThanOrEqual(2);
   expect(await panel.locator('.fuel-row').count()).toBe(fuels.length);
   const row=panel.locator('.fuel-row').first();
   await row.getByRole('button',{name:'แก้ไขราคาน้ำมัน'}).click();
   await expect(row.locator('.fuel-row-controls')).toBeVisible();
   // No Save is clicked: prices and enable states must remain unchanged.
  });
  console.log('FUN Fuel catalog '+station.code+' PASS');
 }
});
test('FUN-03 12 Corporate Admins inspect wallet, actual driver assignment and QR form @qa-functional',async({browser})=>{
 test.setTimeout(14*60*1000);
 for(const company of companies){
  await inBrowser(browser,async page=>{
   const token=await login(page,company.station,company.alias+'-admin','corporate_admin',company.id,'corporateCompanyId');
   await visit(page,'corporate');
   const accounts=await get(page,token,'/api/my-accounts');
   expect(accounts.status()).toBe(200);
   const own=(await accounts.json()).accounts||[];
   expect(own.some(a=>a.companyId===company.id)).toBe(true);
   const pane=page.locator('[data-context-for="corporate"] [data-os-pane-key="driver"]');
   await expect(pane).toBeVisible({timeout:20000});
   await pane.click();
   const host=page.locator('#company-driver-workspace');
   await expect(host).toBeVisible();
   await expect(host.locator('select')).toHaveCount(1);
   const roster=await get(page,token,'/api/corporate/drivers?companyId='+company.id);
   expect(roster.status()).toBe(200);
   const person=(await roster.json()).drivers||[];
   expect(person).toHaveLength(1);
   await expect(host.locator('select')).toHaveValue(person[0].userId);
   const qrTab=page.locator('[data-context-for="corporate"] [data-os-pane-key="coupon"]');
   await expect(qrTab).toBeVisible({timeout:20000});
   await qrTab.click();
   await expect(page.locator('#coupon-form')).toBeVisible();
   const other=companies.find(c=>c.id!==company.id);
   const forbidden=await get(page,token,'/api/corporate/drivers?companyId='+other.id);
   expect(forbidden.status()).toBe(403);
  });
  console.log('FUN Corporate wallet/driver/QR form '+company.alias+' PASS');
 }
});
test('FUN-04 all four cashiers can open actual pump scan workspace @qa-functional',async({browser})=>{
 test.setTimeout(6*60*1000);
 for(const station of stations){
  await inBrowser(browser,async page=>{
   await login(page,station,station.code+'-cashier','cashier',station.id,'stationId');
   await visit(page,'pump');
   await expect(page.locator('#station-pump-workspace')).not.toBeEmpty();
   await expect(page.locator('[data-ws-go="finance"]')).toHaveCount(0);
   // Do not start camera, invent a plate, scan a real QR or fuel.
  });
  console.log('FUN Pump cashier '+station.code+' PASS');
 }
});
test('FUN-05 HR managers load roster, approval inbox and payroll preview @qa-functional',async({browser})=>{
 test.setTimeout(7*60*1000);
 for(const station of stations){
  await inBrowser(browser,async page=>{
   const token=await login(page,station,station.code+'-hr','hr_manager',station.id,'stationId');
   await visit(page,'hr');
   await expect(page.locator('#hr-workspace')).not.toBeEmpty();
   const roster=await get(page,token,'/api/hr/roster?stationId='+station.id);
   if(roster.status()===503 && (await roster.json()).error==='release_not_enabled'){
    console.log('BLOCKED FUN-05: /api/hr/roster is intentionally disabled by production preview release gate');
    test.skip(true,'BLOCKED: QA HR backend not available while OILSTATION_API_ENABLED=false');
   }
   expect(roster.status()).toBe(200);
   expect(Array.isArray((await roster.json()).roster?.employees)).toBe(true);
   await visit(page,'reviews');
   await expect(page.locator('#load-attendance-review')).toBeVisible();
   await page.locator('#load-attendance-review').click();
   await expect(page.locator('#attendance-review-list')).toContainText('ไม่มีรายการลงเวลาที่รอตรวจ',{timeout:15000});
   await visit(page,'payroll');
   await expect(page.locator('.attendance-payroll-preview')).toBeVisible();
   await page.getByRole('button',{name:'โหลดรายชื่อพนักงาน'}).click();
   await expect(page.locator('.attendance-payroll-preview [role="status"]')).toContainText('ไม่มีพนักงานที่ดูได้',{timeout:15000});
  });
  console.log('FUN HR roster/approvals/payroll '+station.code+' PASS');
 }
});
test('FUN-06 four station owners inspect finance pending queue, without approval @qa-functional',async({browser})=>{
 test.setTimeout(7*60*1000);
 for(const station of stations){
  await inBrowser(browser,async page=>{
   const token=await login(page,station,station.code+'-owner','station_owner',station.id,'stationId');
   await visit(page,'finance');
   await expect(page.locator('#finance-refresh')).toBeVisible({timeout:25000});
   await page.locator('#finance-refresh').click();
   const response=await get(page,token,'/api/topup/pending?stationId='+station.id);
   if(response.status()===503 && (await response.json()).error==='release_not_enabled'){
    await expect(page.locator('#finance-error')).toBeVisible({timeout:15000});
    console.log('BLOCKED FUN-06: /api/topup/pending is intentionally disabled by production preview release gate');
    test.skip(true,'BLOCKED: QA finance pending queue unavailable while OILSTATION_API_ENABLED=false');
   }
   await expect(page.locator('#pending-topup-list')).toContainText('ไม่มีรายการเติมเงินที่รอตรวจสอบ',{timeout:15000});
   expect(response.status()).toBe(200);
   expect((await response.json()).requests).toHaveLength(0);
  });
  console.log('FUN Finance queue '+station.code+' PASS');
 }
});
