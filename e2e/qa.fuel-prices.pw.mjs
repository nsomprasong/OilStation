import {test,expect} from '@playwright/test';

// Manual, authenticated and deployment-gated. All 8 writes use real Fuel UI
// on EXACTLY four QA stations. No direct SQL writes or production pump prices.
const STATIONS=[
 {code:'s01a',name:'QA-S01-A',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9'},
 {code:'s01b',name:'QA-S01-B',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35'},
 {code:'s02a',name:'QA-S02-A',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be'},
 {code:'s02b',name:'QA-S02-B',id:'02183a4e-47b0-4575-9f4f-74cec6553205'},
];
const BASE='https://oilstation.goldensoft.cloud';
function secret(code){
 const v=process.env['OILSTATION_QA_'+code.toUpperCase()+'_OWNER_PASSWORD'];
 if(!v)throw new Error('Missing protected QA station owner secret for '+code);
 return v;
}
async function signIn(page,station){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(station.code+'-owner');
 await page.locator('#qa-login-password').fill(secret(station.code));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="fuel"]:visible').first()).toBeVisible();
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{return JSON.parse(localStorage.getItem(k)).access_token;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 // Verify this owner account has one and ONLY one scoped station membership.
 const me=await page.request.get(BASE+'/api/me',{
  headers:{authorization:'Bearer '+token},
 });
 expect(me.status()).toBe(200);
 const active=(await me.json()).memberships.filter(m=>m.scopeType==='station'&&
  ['station_owner','owner'].includes(m.role));
 expect(active).toHaveLength(1);
 expect(active[0].stationId).toBe(station.id);
 return token;
}
test('real QA station-owner web form posts fictional price on four stations @qa-fuel-prices',
 async({browser})=>{
 test.skip(process.env.OILSTATION_QA_PRICE_AUTH_RUN!=='true',
  'Run only via protected workflow_dispatch from deployed main');
 // Fail closed BEFORE first write if one of the four secrets is absent.
 for(const s of STATIONS)secret(s.code);
 for(const station of STATIONS){
  const page=await browser.newPage();
  try{
   const token=await signIn(page,station);
   await page.locator('[data-ws-go="fuel"]:visible').first().click();
   const fuelPanel=page.locator('#station-fuel-workspace');
   await expect(fuelPanel.locator('.fuel-row').first()).toBeVisible();
   for(const chosen of [
    {pattern:/ดีเซล/,rate:'32.50'},
    {pattern:/แก๊สโซฮอล์.*95/,rate:'35.90'},
   ]){
    const row=fuelPanel.locator('.fuel-row').filter({hasText:chosen.pattern}).first();
    await expect(row).toBeVisible();
    await row.getByRole('button',{name:'ใช้ราคาทดสอบ '+chosen.rate}).click();
    await expect(row.locator('input[type=checkbox]')).toBeChecked();
    await expect(row.locator('input:not([type=checkbox])')).toHaveValue(chosen.rate);
    await row.getByRole('button',{name:'บันทึก',exact:true}).click();
    await expect(row.getByRole('status')).toContainText('บันทึกราคาและเปิดขายแล้ว');
   }
   // Verify writes by the same authenticated user's real API.
   const r=await page.request.get(BASE+'/api/station-fuels?stationId='+station.id,
    {headers:{authorization:'Bearer '+token}});
   expect(r.status()).toBe(200);
   const fuels=(await r.json()).fuels||[];
   expect(fuels.some(f=>/ดีเซล/.test(f.name)&&f.enabled&&Number(f.publicPrice)===32.50)).toBe(true);
   expect(fuels.some(f=>/แก๊สโซฮอล์.*95/.test(f.name)&&f.enabled&&Number(f.publicPrice)===35.90)).toBe(true);
  }finally{await page.close();}
 }
});
