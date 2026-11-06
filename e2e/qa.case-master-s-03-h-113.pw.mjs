import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-03-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-03-H authorized scope',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const api=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(api.status()).toBe(200);const list=(await api.json()).fuels;expect(list.length).toBeGreaterThanOrEqual(5);expect(list.every(x=>x.id&&typeof x.enabled==='boolean')).toBe(true);await page.locator('[data-ws-screen="overview"] [data-ws-go="fuel"]:visible').first().click();await expect(page.locator('[data-ws-screen="fuel"]:visible')).toBeVisible();await expect(page.locator('#station-fuel-workspace')).not.toBeEmpty({timeout:20000});console.log('MASTER_CASE S-03-H REAL_BRAND_FUEL_CATALOG_AND_PRICE_EDITOR_RENDER_PASS (positive price save pending)');
}});
