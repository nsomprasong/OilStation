import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected six entirely new cases.
const MASTER_UAT_ID='X-09-F';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-09-F authenticated UAT',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const r=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(r.status()).toBe(200);const accounts=(await r.json()).accounts;expect(accounts).toHaveLength(3);const fuels=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(fuels.status()).toBe(200);const catalog=(await fuels.json()).fuels;expect(catalog.length).toBeGreaterThanOrEqual(5);const again=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(again.status()).toBe(200);expect((await again.json()).accounts).toEqual(accounts);const againFuel=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(againFuel.status()).toBe(200);expect((await againFuel.json()).fuels).toEqual(catalog);console.log('MASTER_CASE X-09-F QA_PROTECTED_STATION_ACCOUNT_AND_FUEL_CATALOG_BASELINE_UNCHANGED_PASS');
}});
