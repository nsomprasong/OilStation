import {test,expect} from '@playwright/test';
// Case 013: real station fuel price editor rejects invalid input before any API write.
// A single existing station, one fuel row, and no price/status mutation.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-FUEL-PRICE-INVALID-013';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected single-case GitHub workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA review Secret missing');
});
test(CASE+': invalid station fuel price is rejected locally without write @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const writes=[],errors=[];
 page.on('pageerror',()=>errors.push('client_js_error'));
 page.on('request',r=>{
  try{const u=new URL(r.url());
   if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))
    writes.push([u.pathname,r.method()]);
  }catch{}
 });
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const t=JSON.parse(localStorage.getItem(k));if(t?.access_token)return t.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: s01b owner');

 const readFuels=async()=>{
  const response=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION,{headers});
  expect(response.status(),'authorized station fuel GET').toBe(200);
  const fuels=(await response.json()).fuels;
  expect(Array.isArray(fuels)).toBe(true);
  return fuels;
 };
 const before=await readFuels();
 expect(before.length,'QA station has fuel catalog').toBeGreaterThan(0);
 const selected=before.find(f=>f.id&&f.name);
 expect(selected).toBeTruthy();
 console.log('QA_CASE '+CASE+' API_PASS: real scoped station fuel catalog');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="fuel"]:visible').first();
 await expect(tile).toBeVisible({timeout:14000});
 await tile.click();
 const panel=page.locator('#station-fuel-workspace');
 await expect(panel.locator('.fuel-row').first()).toBeVisible({timeout:15000});
 const row=panel.locator('.fuel-row[data-station-fuel-id="'+selected.id+'"]');
 await expect(row).toBeVisible();
 const edit=row.getByRole('button',{name:'แก้ไขราคาน้ำมัน'});
 await expect(edit).toBeVisible();
 await edit.click();
 const controls=row.locator('.fuel-row-controls');
 await expect(controls).toBeVisible();
 const price=controls.locator('input:not([type=checkbox])');
 const save=controls.getByRole('button',{name:'บันทึก',exact:true});
 const status=row.getByRole('status');
 const original=await price.inputValue();
 for(const invalid of ['0','-1','12.12345']){
  await price.fill(invalid);
  await save.click();
  await expect(status).toHaveText('กรุณาใส่ราคาบาทต่อลิตรเป็นตัวเลขมากกว่า 0');
  expect(writes,'invalid '+invalid+' must not send a POST').toEqual([]);
 }
 console.log('QA_CASE '+CASE+' VALIDATION_PASS: zero, negative and excess decimals rejected without API write');
 await price.fill(original);
 const after=await readFuels();
 const same=after.find(f=>f.id===selected.id);
 expect(same).toBeTruthy();
 expect(same.publicPrice,'persisted price not altered').toEqual(selected.publicPrice);
 expect(same.enabled,'sell status not altered').toEqual(selected.enabled);
 expect(writes,'no operations POST was sent').toEqual([]);
 expect(errors,'no uncaught JS errors').toEqual([]);
 console.log('QA_CASE '+CASE+' UNCHANGED_PASS: API price and enabled identical to baseline');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + API_PASS + VALIDATION_PASS + UNCHANGED_PASS + NO_WRITES');
});
