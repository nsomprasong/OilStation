import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-02-F';
masterCase({id:MASTER_UAT_ID,description:'failed-network-retry-uses-identical-request-id-without-fifth',alias:'sales02',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const url=BASE+'/api/platform/sales/stations';
const beforeRes=await page.request.get(url,{headers});expect(beforeRes.status()).toBe(200);
const before=(await beforeRes.json()).stations;expect(before).toHaveLength(2);
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
const add=page.locator('[data-ws-screen="stations"] > .os-add-fab');await expect(add).toBeVisible();await add.click();
const form=page.locator('#new-station-form');await expect(form).toBeVisible();
await form.locator('#org-name').fill('QA NETWORK ABORT NEVER CREATED');
await form.locator('#station-name').fill('QA FIFTH PREVENTED');
await form.locator('#brand-select').selectOption('PTT');
await expect(form.locator('#new-station-submit')).toBeEnabled({timeout:18000});
// Use an independent browser page for expected POSTs so the shared outer harness
// still catches unexpected writes on its primary page.
const browser=page.context().browser();const ctx=await browser.newContext({viewport:{width:390,height:844}});
try{
 const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(p.locator('#qa-login-form')).toBeVisible();
 await p.locator('#qa-login-alias').fill('sales02');await p.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await p.locator('#qa-login-form button[type="submit"]').click();
 await expect(p.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:35000});
 await p.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
 const fab=p.locator('[data-ws-screen="stations"] > .os-add-fab');await expect(fab).toBeVisible();await fab.click();
 const f=p.locator('#new-station-form');await expect(f).toBeVisible();
 await f.locator('#org-name').fill('QA NETWORK ABORT NEVER CREATED');
 await f.locator('#station-name').fill('QA FIFTH PREVENTED');
 await f.locator('#brand-select').selectOption('PTT');
 await expect(f.locator('#new-station-submit')).toBeEnabled({timeout:18000});
 const captured=[];p.on('request',req=>{if(new URL(req.url()).pathname==='/api/platform/sales/create-station'&&req.method()==='POST')captured.push(req.postDataJSON()?.requestId)});
 await p.route('**/api/platform/sales/create-station',route=>route.abort('internetdisconnected'));
 await f.locator('#new-station-submit').click();
 await expect(f.locator('#platform-notice')).toContainText('ขัดข้องระหว่างสร้างปั๊ม',{timeout:16000});
 await expect(f.locator('#new-station-submit')).toBeEnabled();
 await p.unroute('**/api/platform/sales/create-station');
 const attempted=p.waitForResponse(x=>new URL(x.url()).pathname==='/api/platform/sales/create-station',{timeout:16000});
 await f.locator('#new-station-submit').click();
 expect((await attempted).status()).toBe(409);
 await expect(f.locator('#platform-notice')).toContainText('ไม่สามารถสร้างปั๊มได้',{timeout:16000});
 expect(captured).toHaveLength(2);expect(captured[0]).toBe(captured[1]);
 expect(captured[0]).toMatch(/^[0-9a-f-]{36}$/);
}finally{await ctx.close();}
const afterRes=await page.request.get(url,{headers});expect(afterRes.status()).toBe(200);
expect((await afterRes.json()).stations).toEqual(before);
console.log('MASTER_CASE P-02-F NETWORK_ABORT_RETRY_SAME_ID_REJECTED_409_NO_FIFTH_STATION_PASS');
}});
