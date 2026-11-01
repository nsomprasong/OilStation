import {test,expect} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';

// Authenticated fixed-fixture QA only. Coordinates are deliberately SYNTHETIC:
// this is API/role integration evidence, NOT physical GPS or face attestation.
const BASE='https://oilstation.goldensoft.cloud';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const OTHER='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
function password(role){
 const secret=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!secret)throw Error('Missing fixed QA secret');
 return createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/s01a-'+role)
  .digest('base64url').slice(0,30)+'a9!';
}
async function login(page,role){
 const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(response?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill('s01a-'+role);
 await page.locator('#qa-login-password').fill(password(role));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="overview"]:visible').first())
  .toBeVisible({timeout:40000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{return JSON.parse(localStorage.getItem(k))?.access_token||null;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 const me=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(me.status()).toBe(200);
 return {token,userId:(await me.json()).userId};
}
const get=(page,token,path)=>page.request.get(BASE+path,{
 headers:{authorization:'Bearer '+token},
});
const post=(page,token,path,data)=>page.request.post(BASE+path,{
 headers:{authorization:'Bearer '+token,origin:BASE,'content-type':'application/json'},
 data,
});
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-GPS-01 linked existing attendant, synthetic geofence GPS, independent review and NONpayable preview @qa-gps-linked',
 async({browser,request})=>{
  test.skip(process.env.OILSTATION_QA_GPS_LINKED_RUN!=='true',
   'Only a time-bounded, QA-identity-only, main-branch workflow can write the fictional GPS fixture');
  test.setTimeout(9*60*1000);
  const cfg=await request.get(BASE+'/api/public-config');
  expect(cfg.status()).toBe(200);
  expect((await cfg.json()).qaFinanceSimEnabled).toBe(false);
  const owner=await browser.newPage(),attendant=await browser.newPage();
  try{
   const own=await login(owner,'owner'),staff=await login(attendant,'attendant');
   expect(staff.userId).toMatch(/^[0-9a-f-]{36}$/);
   const rosterRes=await get(owner,own.token,'/api/hr/roster?stationId='+STATION);
   expect(rosterRes.status()).toBe(200);
   const roster=(await rosterRes.json()).roster;
   const employee=roster.employees.find(e=>e.code==='QA261101S01A');
   expect(employee,'Preexisting fictional QA employee').toBeTruthy();

   const binding={stationId:STATION,employeeId:employee.id,userId:staff.userId};
   const foreign=await post(owner,own.token,'/api/hr/employee-link',
     {...binding,stationId:OTHER});
   expect(foreign.status(),'foreign station link must fail').toBe(403);
   const disallowed=await post(attendant,staff.token,'/api/hr/employee-link',binding);
   expect(disallowed.status(),'staff cannot bind their own login').toBe(403);

   const linked=await post(owner,own.token,'/api/hr/employee-link',binding);
   expect(linked.status(),'owner links existing QA employee to existing QA attendant').toBe(200);
   expect((await linked.json()).result.userId).toBe(staff.userId);
   const replay=await post(owner,own.token,'/api/hr/employee-link',binding);
   expect(replay.status()).toBe(200);
   expect((await replay.json()).result.replayed).toBe(true);

   // These are QA-only synthetic coordinates, not the device's real location.
   const geo={stationId:STATION,latitude:13.7563,longitude:100.5018,
      radiusMeters:150,maxAccuracyMeters:100};
   const wrongGeo=await post(owner,own.token,'/api/hr/geofence',
     {...geo,stationId:OTHER});
   expect(wrongGeo.status()).toBe(403);
   const configured=await post(owner,own.token,'/api/hr/geofence',geo);
   expect(configured.status()).toBe(200);
   expect((await configured.json()).result.configured).toBe(true);

   await attendant.locator('[data-ws-go="attendance"]:visible').first().click();
   await expect(attendant.locator('[data-ws-screen="attendance"]:visible')).toBeVisible();
   const stamp=randomUUID().replaceAll('-','');
   const punch=async(type,key)=>post(attendant,staff.token,'/api/hr/attendance/gps',{
      stationId:STATION,eventType:type,latitude:geo.latitude,longitude:geo.longitude,
      accuracyMeters:10,idempotencyKey:key,
   });
   const inside=await punch('clock_in',stamp+'IN');
   expect(inside.status()).toBe(202);
   const first=(await inside.json()).attendance;
   expect(first.status).toBe('pending');
   expect(first.geofence).toBe('inside');
   expect(first.faceVerified).toBe(false);
   const retry=await punch('clock_in',stamp+'IN');
   expect(retry.status()).toBe(202);
   expect((await retry.json()).attendance.replayed).toBe(true);
   const outside=await punch('clock_out',stamp+'OUT');
   expect(outside.status()).toBe(202);
   const second=(await outside.json()).attendance;
   expect(second.status).toBe('pending');
   expect(second.faceVerified).toBe(false);

   const pending=await get(owner,own.token,'/api/hr/attendance/pending?stationId='+STATION);
   expect(pending.status()).toBe(200);
   const ids=(await pending.json()).events.map(e=>e.eventId);
   expect(ids).toContain(first.id);
   expect(ids).toContain(second.id);
   for(const eventId of [first.id,second.id]){
    const reviewed=await post(owner,own.token,'/api/hr/attendance/review',{
      eventId,approved:true,reason:'Independent fictional QA attendance review',
    });
    expect(reviewed.status()).toBe(200);
    expect((await reviewed.json()).result.status).toBe('accepted');
   }
   const preview=await get(owner,own.token,'/api/hr/attendance/payroll-preview?'+
      new URLSearchParams({employeeId:employee.id,startDate:'2026-11-01',
       endDate:'2026-11-30'}));
   expect([200,409],'no payable payroll may be produced by synthetic GPS')
     .toContain(preview.status());
   if(preview.status()===200){
    const p=await preview.json();
    expect(p.status).toBe('preview_only');
    expect(p.payable).toBe(false);
    expect(p.faceVerified).toBe(false);
   }
   console.log('QA-GPS PASS: existing linked user, geofence, PENDING synthetic punches, independent manual review, no real GPS/face/payroll payout');
  }finally{await Promise.all([owner.close(),attendant.close()]);}
 });
