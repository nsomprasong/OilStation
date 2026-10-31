import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// Actual deployed browser + real QA HR RPCs, no bank, customer, or payroll payouts.
// Creates at most one fictional QA employee and one assigned shift per fixed station.
const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9'},
 {code:'s01b',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'},
 {code:'s02a',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be'},
 {code:'s02b',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205'},
];
function pwd(station,suffix){
 const key=process.env['OILSTATION_QA_'+station.sales.toUpperCase()+'_PASSWORD'];
 if(!key)throw Error('Missing protected QA Sales secret');
 return createHmac('sha256',key)
  .update('OilStation QA station role account 20261031/v1/'+station.code+'-'+suffix)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,station,suffix,role){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(station.code+'-'+suffix);
 await page.locator('#qa-login-password').fill(pwd(station,suffix));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="hr"]:visible').first()).toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(k.startsWith('sb-')&&k.endsWith('-auth-token'))
    try{return JSON.parse(localStorage.getItem(k))?.access_token||null;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const r=await get(page,token,'/api/me');
 expect(r.status()).toBe(200);
 const data=await r.json();
 expect(data.memberships).toHaveLength(1);
 expect(data.memberships[0].role).toBe(role);
 expect(data.memberships[0].stationId).toBe(station.id);
 return token;
}
const get=(page,token,path)=>page.request.get(BASE+path,{
 headers:{authorization:'Bearer '+token},
});
const post=(page,token,path,body)=>page.request.post(BASE+path,{
 headers:{authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},
 data:body,
});
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-HR-01 four real owners create employee, templates and shift; separate HR manager checks scoped data @qa-business-hr',
 async({browser,request})=>{
  test.skip(process.env.OILSTATION_QA_BUSINESS_HR_RUN!=='true',
   'Only protected, same-commit, time-bounded QA UAT is allowed to insert HR fixtures.');
  test.setTimeout(16*60*1000);
  const cfg=await request.get(BASE+'/api/public-config');
  expect(cfg.status()).toBe(200);
  expect((await cfg.json()).qaFinanceSimEnabled).toBe(true);
  for(const station of stations){
   const owner=await browser.newPage(),hr=await browser.newPage();
   try{
    const ot=await login(owner,station,'owner','station_owner');
    const ht=await login(hr,station,'hr','hr_manager');
    await owner.locator('[data-ws-go="hr"]:visible').first().click();
    await expect(owner.locator('#hr-workspace')).not.toBeEmpty();
    const foreign=stations.find(s=>s.id!==station.id);
    const foreignRoster=await get(owner,ot,'/api/hr/roster?stationId='+foreign.id);
    expect(foreignRoster.status()).toBe(403);
    let rosterResponse=await get(owner,ot,'/api/hr/roster?stationId='+station.id);
    expect(rosterResponse.status()).toBe(200);
    let roster=(await rosterResponse.json()).roster;
    expect(Array.isArray(roster.employees)).toBe(true);
    expect(Array.isArray(roster.shiftTemplates)).toBe(true);
    if(roster.shiftTemplates.length===0){
     const seeded=await post(owner,ot,'/api/hr/seed-shifts',{stationId:station.id});
     expect(seeded.status()).toBe(200);
    }
    rosterResponse=await get(owner,ot,'/api/hr/roster?stationId='+station.id);
    roster=(await rosterResponse.json()).roster;
    expect(roster.shiftTemplates.length).toBeGreaterThanOrEqual(3);
    const code='QA261101'+station.code.toUpperCase();
    let employee=roster.employees.find(e=>e.code===code);
    if(!employee){
     const added=await post(owner,ot,'/api/hr/employees',{
      stationId:station.id,employeeCode:code,name:'พนักงานจำลอง '+station.code,
      wageType:'daily',wageSatang:'45000',payrollFrequency:'monthly',
     });
     expect(added.status()).toBe(201);
     rosterResponse=await get(owner,ot,'/api/hr/roster?stationId='+station.id);
     employee=(await rosterResponse.json()).roster.employees.find(e=>e.code===code);
    }
    expect(employee?.id).toBeTruthy();
    const hrRoster=await get(hr,ht,'/api/hr/roster?stationId='+station.id);
    expect(hrRoster.status()).toBe(200);
    const data=(await hrRoster.json()).roster;
    expect(data.employees.some(e=>e.id===employee.id)).toBe(true);
    if(!data.assignments.some(a=>a.employeeId===employee.id&&a.date==='2026-11-15')){
     const assigned=await post(hr,ht,'/api/hr/assign-shift',{
      stationId:station.id,employeeId:employee.id,
      templateId:data.shiftTemplates[0].id,date:'2026-11-15',
     });
     expect(assigned.status()).toBe(201);
    }
    const final=await get(hr,ht,'/api/hr/roster?stationId='+station.id);
    expect(final.status()).toBe(200);
    expect((await final.json()).roster.assignments.some(
     a=>a.employeeId===employee.id)).toBe(true);
    const pending=await get(hr,ht,'/api/hr/attendance/pending?stationId='+station.id);
    expect(pending.status()).toBe(200);
    expect((await pending.json()).events).toHaveLength(0);
    await hr.locator('[data-ws-go="hr"]:visible').first().click();
    await expect(hr.locator('#hr-workspace')).toContainText('พนักงานจำลอง '+station.code);
    console.log('QA-HR REAL PASS '+station.code+' employee, shift, HR manager, cross-tenant denied');
   }finally{await Promise.all([owner.close(),hr.close()]);}
  }
 });
