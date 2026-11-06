import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-01-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-01-R authorized scope',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers});expect(own.status()).toBe(200);expect((await own.json()).fuels.length).toBeGreaterThan(0);for(const url of ['/api/station-fuels?stationId='+STATION_B,'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_B})]){const blocked=await page.request.get(BASE+url,{headers});expect(blocked.status(),url).toBe(403);expect(await blocked.json()).toEqual({error:'permission_denied'});}console.log('MASTER_CASE S-01-R STATION_CROSS_SCOPE_FUEL_AND_MEMBER_DIRECTORY_DENIED_PASS (mutation not executed)');
}});
