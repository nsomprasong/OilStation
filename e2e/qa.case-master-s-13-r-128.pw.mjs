import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN new only; no accepted writes.
const MASTER_UAT_ID='S-13-R';
masterCase({id:MASTER_UAT_ID,description:'bounded S-13-R role and validation acceptance',alias:'c01-accountant',role:'accountant',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/my-accounts',{headers});expect(own.status()).toBe(200);expect((await own.json()).accounts).toHaveLength(1);for(const p of ['/api/station/customer-overview?stationId='+STATION_A,'/api/station/billing/options?stationId='+STATION_A]){const denied=await page.request.get(BASE+p,{headers});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});}expect(await page.locator('[data-ws-screen="finance"]').count()).toBe(0);console.log('MASTER_CASE S-13-R CORPORATE_ACCOUNTANT_CANNOT_BYPASS_STATION_CREDIT_AND_SAAS_VERIFICATION_PERMISSIONS_PASS');
}});
