import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-09-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-09-H authorized scope',alias:'s02a-owner',role:'station_owner',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const res=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_S02A,{headers});expect(res.status()).toBe(200);const accounts=(await res.json()).accounts;expect(accounts).toHaveLength(3);expect(new Set(accounts.map(x=>x.companyName))).toEqual(new Set(['QA-S02-A-C01','QA-S02-A-C02','QA-S02-A-C03']));await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');await expect(tab).toBeVisible();await tab.click();const cards=page.locator('#station-customer-credit .os-credit-account');await expect(cards).toHaveCount(3,{timeout:20000});for(const a of accounts)await expect(cards.filter({hasText:a.companyName})).toHaveCount(1);console.log('MASTER_CASE S-09-H THREE_EXISTING_DISTINCT_CROSS_COMPANY_ACCOUNTS_S02A_UI_API_PASS (creation by owner not replayed)');
}});
