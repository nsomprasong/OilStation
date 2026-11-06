import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN new only; no accepted writes.
const MASTER_UAT_ID='P-04-H';
masterCase({id:MASTER_UAT_ID,description:'bounded P-04-H role and validation acceptance',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const r=await page.request.get(BASE+'/api/station/billing/options?stationId='+STATION_B,{headers});expect(r.status()).toBe(200);const data=(await r.json()).result;expect(Array.isArray(data.plans)).toBe(true);expect(data.plans.length).toBeGreaterThanOrEqual(2);await page.locator('[data-ws-screen="overview"] [data-ws-go="plan"]:visible').first().click();await expect(page.locator('[data-ws-screen="plan"]:visible')).toBeVisible();await expect(page.locator('#station-saas-plan-workspace')).not.toBeEmpty({timeout:18000});console.log('MASTER_CASE P-04-H OWNER_REAL_PLAN_OPTIONS_AND_UI_READ_PASS (post-purchase module activation still unproven)');
}});
