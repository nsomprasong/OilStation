import {masterCase,STATION_S02A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='S-14-R';
masterCase({id:MASTER_UAT_ID,description:'cross-station-credit-ledger-read-denied',alias:'s02a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_S02A,
 check:async({page,auth,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_S02A,{headers});
expect(own.status()).toBe(200);expect((await own.json()).accounts).toHaveLength(3);
const denied=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE S-14-R FOREIGN_STATION_CREDIT_WALLET_OVERVIEW_DENIED_PASS; direct append-only ledger separately gated');
}});
