import {masterCase,qaLogin,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-03-H';
masterCase({id:MASTER_UAT_ID,description:'active-brand-draft-and-existing-staged-fuels',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const branded=await page.request.get(BASE+'/api/fuel-brands',{headers});expect(branded.status()).toBe(200);
const brands=(await branded.json()).brands;expect(Array.isArray(brands)).toBe(true);
expect(brands.some(x=>x.code==='PTT')).toBe(true);
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
const add=page.locator('[data-ws-screen="stations"] > .ws-screen-head .os-station-create-cta');await expect(add).toBeVisible();await add.click();
const form=page.locator('#new-station-form');await expect(form).toBeVisible();
await expect(form).toHaveAttribute('data-os-station-submit-ready','true',{timeout:22000});
const select=form.locator('#brand-select');await expect.poll(()=>select.locator('option').count(),{timeout:12000}).toBeGreaterThan(1);
await select.selectOption('PTT');
await expect(form.locator('#module-qr')).toBeChecked();
await expect(form.locator('#module-hr')).not.toBeChecked();
await expect(form).toContainText('ยังไม่เปิดขายจนกว่าจะตั้งราคาและเปิดใช้งาน');
const ctx=await page.context().browser().newContext({viewport:{width:390,height:844}});
try{
 const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});
 const owner=await qaLogin(p,'s01a-owner','station_owner','station',STATION_A);
 const res=await p.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers:owner.headers});
 expect(res.status()).toBe(200);const fuels=(await res.json()).fuels;
 expect(fuels).toHaveLength(10);expect(fuels.filter(x=>x.enabled===false)).toHaveLength(8);
 expect(fuels.filter(x=>x.enabled===true)).toHaveLength(2);
 for(const f of fuels.filter(x=>x.enabled===false))expect(f.publicPrice==null||Number(f.publicPrice)===0).toBe(true);
}finally{await ctx.close();}
console.log('MASTER_CASE P-03-H PTT_ACTIVE_DRAFT_MODULES_AND_EIGHT_UNPRICED_STAGED_FUELS_PASS; new station creation deferred');
}});
