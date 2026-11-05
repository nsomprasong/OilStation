import {masterCase,STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='S-22-V';
masterCase({id:MASTER_UAT_ID,description:'tiny-mobile-station-empty-offline-resilience',alias:'s01b-attendant',role:'attendant',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
await page.setViewportSize({width:320,height:800});await expect(page.locator('.os-mobile-bottom:visible')).toBeVisible();
const dims=await page.evaluate(()=>({available:document.documentElement.clientWidth,drawn:document.documentElement.scrollWidth}));
expect(dims.drawn,'mobile page horizontal clipping').toBeLessThanOrEqual(dims.available+2);
await page.locator('[data-ws-screen="overview"] [data-ws-go="pump"]:visible').first().click();
await expect(page.locator('[data-ws-screen="pump"]:visible')).toBeVisible();
await page.context().setOffline(true);const offline=await page.evaluate(()=>fetch('/api/health').then(()=>'unexpected').catch(()=>'network_failed'));expect(offline).toBe('network_failed');
await page.context().setOffline(false);await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('[data-ws-screen="overview"]')).toHaveCount(1);
console.log('MASTER_CASE S-22-V TINY_MOBILE_AND_OFFLINE_RECOVERY_PASS');
}});
