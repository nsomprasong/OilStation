import {masterCase,COMPANY_C01,STATION_A,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='C-02-R';
masterCase({id:MASTER_UAT_ID,description:'corporate-company-cross-station-relation-hidden',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/my-accounts',{headers});
expect(own.status()).toBe(200);const accounts=(await own.json()).accounts;
expect(accounts).toHaveLength(1);
expect(accounts[0].companyId).toBe(COMPANY_C01);
expect(accounts[0].stationId).toBe(STATION_A);
const denied=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_S02B,{headers});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE C-02-R CORPORATE_ACCOUNT_LINK_RESTRICTED_TO_ORIGINAL_STATION_PASS');
}});
