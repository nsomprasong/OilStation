import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-01-F';
masterCase({id:MASTER_UAT_ID,description:'session-reload-qa-toggle-observation',alias:'sales02',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const cfg=await page.request.get(BASE+'/api/public-config');expect(cfg.status()).toBe(200);expect((await cfg.json()).qaModeEnabled).toBe(true);
await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
await expect(page.locator('[data-ws-go="sales"]:visible').first()).toBeVisible();
const fresh=await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')&&JSON.parse(localStorage.getItem(k))?.access_token));expect(fresh).toBe(true);
console.log('MASTER_CASE P-01-F QA_SESSION_RECOVERY_PASS; disabling QA mode not attempted');
}});
