import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected six entirely new cases.
const MASTER_UAT_ID='X-09-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-09-R authenticated UAT',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const before=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(before.status()).toBe(200);expect((await before.json()).accounts).toHaveLength(3);const del=await page.request.delete(BASE+'/api/station/customers',{headers:{...headers,origin:BASE}});expect(del.status()).toBe(405);const noDelete=await page.request.delete(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_A}),{headers});expect(noDelete.status()).toBe(405);const verify=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(verify.status()).toBe(200);expect((await verify.json()).accounts).toHaveLength(3);console.log('MASTER_CASE X-09-R LIVE_AUTHENTICATED_DELETE_METHODS_405_WITHOUT_DATA_CHANGE_PASS (SQL GRANT independently reviewed)');
}});
