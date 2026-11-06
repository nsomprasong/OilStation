import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected new Master test.
const MASTER_UAT_ID='S-11-R';
masterCase({id:MASTER_UAT_ID,description:'bounded S-11-R role/credit read guard',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(own.status()).toBe(200);const rows=(await own.json()).accounts;expect(rows.length).toBe(3);const foreign=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'permission_denied'});const after=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(after.status()).toBe(200);expect((await after.json()).accounts).toEqual(rows);console.log('MASTER_CASE S-11-R FOREIGN_STATION_CORPORATE_CREDIT_ACCOUNT_READ_DENIED_PASS (updates not sent)');
}});
